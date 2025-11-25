import { Router } from 'express';
import { Pool } from 'pg';

const router = Router();

// Create a connection pool
// In development, we need to handle self-signed certificates
const getPoolConfig = () => {
  const config: any = {
    connectionString: process.env.DATABASE_URL,
  };

  // Always disable SSL certificate verification for local development
  // Check for production indicators (Railway, Vercel, etc.)
  const isProduction = process.env.RAILWAY_ENVIRONMENT || 
                      process.env.VERCEL_ENV === 'production' ||
                      process.env.NODE_ENV === 'production';

  if (!isProduction) {
    console.log('[Promotion Pool] Local development detected - disabling SSL verification');
    config.ssl = {
      rejectUnauthorized: false
    };
  } else {
    console.log('[Promotion Pool] Production environment - SSL verification enabled');
  }

  return config;
};

const pool = new Pool(getPoolConfig());

/**
 * GET /api/tenants/:tenantId/promotion/status
 * Get current promotion status for a tenant
 */
router.get('/tenants/:tenantId/promotion/status', async (req, res) => {
  try {
    const { tenantId } = req.params;

    const result = await pool.query(
      `SELECT 
        is_promoted,
        promotion_tier,
        promotion_started_at,
        promotion_expires_at,
        promotion_impressions,
        promotion_clicks
      FROM directory_listings_list
      WHERE tenantId = $1
        AND (business_hours IS NULL OR business_hours::text != 'null')
      LIMIT 1`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const listing = result.rows[0];
    
    res.json({
      isPromoted: listing.is_promoted || false,
      promotionTier: listing.promotion_tier,
      promotionStartedAt: listing.promotion_started_at,
      promotionExpiresAt: listing.promotion_expires_at,
      promotionImpressions: listing.promotion_impressions || 0,
      promotionClicks: listing.promotion_clicks || 0,
    });
  } catch (error) {
    console.error('Error fetching promotion status:', error);
    res.status(500).json({ error: 'Failed to fetch promotion status' });
  }
});

/**
 * POST /api/tenants/:tenantId/promotion/enable
 * Enable promotion for a tenant
 */
router.post('/tenants/:tenantId/promotion/enable', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { tier, durationMonths } = req.body;

    // Validate tier
    const validTiers = ['basic', 'premium', 'featured'];
    if (!validTiers.includes(tier)) {
      return res.status(400).json({ error: 'Invalid promotion tier' });
    }

    // Validate duration
    if (!durationMonths || durationMonths < 1 || durationMonths > 12) {
      return res.status(400).json({ error: 'Invalid duration' });
    }

    // Calculate expiration date
    const startDate = new Date();
    const expiresAt = new Date(startDate);
    expiresAt.setMonth(expiresAt.getMonth() + durationMonths);

    // Update directory listing
    const result = await pool.query(
      `UPDATE directory_listings_list
      SET 
        is_promoted = TRUE,
        promotion_tier = $1,
        promotion_started_at = $2,
        promotion_expires_at = $3,
        promotion_impressions = 0,
        promotion_clicks = 0
      WHERE tenantId = $4
      RETURNING id`,
      [tier, startDate, expiresAt, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // TODO: Create Stripe subscription here
    // TODO: Send confirmation email

    res.json({
      success: true,
      message: 'Promotion enabled successfully',
      promotionTier: tier,
      promotionExpiresAt: expiresAt,
    });
  } catch (error) {
    console.error('Error enabling promotion:', error);
    res.status(500).json({ error: 'Failed to enable promotion' });
  }
});

/**
 * POST /api/tenants/:tenantId/promotion/disable
 * Disable promotion for a tenant
 */
router.post('/tenants/:tenantId/promotion/disable', async (req, res) => {
  try {
    const { tenantId } = req.params;

    const result = await pool.query(
      `UPDATE directory_listings_list
      SET 
        is_promoted = FALSE,
        promotion_tier = NULL
      WHERE tenantId = $1
      RETURNING id`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // TODO: Cancel Stripe subscription here
    // TODO: Send cancellation email

    res.json({
      success: true,
      message: 'Promotion disabled successfully',
    });
  } catch (error) {
    console.error('Error disabling promotion:', error);
    res.status(500).json({ error: 'Failed to disable promotion' });
  }
});

/**
 * GET /api/tenants/:tenantId/promotion/analytics
 * Get detailed analytics for promotion
 */
router.get('/tenants/:tenantId/promotion/analytics', async (req, res) => {
  try {
    const { tenantId } = req.params;

    const result = await pool.query(
      `SELECT 
        is_promoted,
        promotion_tier,
        promotion_started_at,
        promotion_expires_at,
        promotion_impressions,
        promotion_clicks,
        CASE 
          WHEN promotion_impressions > 0 
          THEN ROUND((promotion_clicks::numeric / promotion_impressions::numeric) * 100, 2)
          ELSE 0 
        END as click_through_rate
      FROM directory_listings_list
      WHERE tenantId = $1
        AND (business_hours IS NULL OR business_hours::text != 'null')
      LIMIT 1`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const listing = result.rows[0];

    // Calculate days active
    let daysActive = 0;
    if (listing.promotion_started_at) {
      const start = new Date(listing.promotion_started_at);
      const now = new Date();
      daysActive = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Calculate average per day
    const avgImpressionsPerDay = daysActive > 0 ? Math.round(listing.promotion_impressions / daysActive) : 0;
    const avgClicksPerDay = daysActive > 0 ? Math.round(listing.promotion_clicks / daysActive) : 0;

    res.json({
      isPromoted: listing.is_promoted || false,
      promotionTier: listing.promotion_tier,
      promotionStartedAt: listing.promotion_started_at,
      promotionExpiresAt: listing.promotion_expires_at,
      impressions: listing.promotion_impressions || 0,
      clicks: listing.promotion_clicks || 0,
      clickThroughRate: listing.click_through_rate || 0,
      daysActive,
      avgImpressionsPerDay,
      avgClicksPerDay,
    });
  } catch (error) {
    console.error('Error fetching promotion analytics:', error);
    res.status(500).json({ error: 'Failed to fetch promotion analytics' });
  }
});

/**
 * POST /api/tenants/:tenantId/promotion/track-impression
 * Track an impression (map view)
 */
router.post('/tenants/:tenantId/promotion/track-impression', async (req, res) => {
  try {
    const { tenantId } = req.params;

    await pool.query(
      `UPDATE directory_listings_list
      SET promotion_impressions = promotion_impressions + 1
      WHERE tenantId = $1 AND is_promoted = TRUE`,
      [tenantId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking impression:', error);
    res.status(500).json({ error: 'Failed to track impression' });
  }
});

/**
 * POST /api/tenants/:tenantId/promotion/track-click
 * Track a click (popup link click)
 */
router.post('/tenants/:tenantId/promotion/track-click', async (req, res) => {
  try {
    const { tenantId } = req.params;

    await pool.query(
      `UPDATE directory_listings_list
      SET promotion_clicks = promotion_clicks + 1
      WHERE tenantId = $1 AND is_promoted = TRUE`,
      [tenantId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking click:', error);
    res.status(500).json({ error: 'Failed to track click' });
  }
});

export default router;
