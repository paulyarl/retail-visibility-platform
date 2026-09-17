-- Migration 266: backfill mkt_prospect_queue.processed_campaign_id for
-- prospects whose campaign was derived directly from the discovery audit
-- (the "Campaign" button on the discovery card). The derive path created
-- the campaign without stamping the queue, so the proving ground's promote
-- panel showed "no campaign" for prospects that already had one.
--
-- Match: campaign's parent_campaign_id = queue entry's source_campaign_id
-- and business names agree (case-insensitive; the queue stores the
-- discovered business_name in both business_name and title). Most recent
-- campaign wins per (source, name) pair. Dismissed entries are left alone.

WITH derived AS (
  SELECT
    c.id AS campaign_id,
    c.parent_campaign_id AS source_campaign_id,
    LOWER(c.business_name) AS business_name,
    c.created_at AS campaign_created_at,
    ROW_NUMBER() OVER (
      PARTITION BY c.parent_campaign_id, LOWER(c.business_name)
      ORDER BY c.created_at DESC
    ) AS rn
  FROM mkt_campaigns_list c
  WHERE c.parent_campaign_id IS NOT NULL
    AND c.business_name IS NOT NULL
)
UPDATE mkt_prospect_queue q
SET processed_campaign_id = d.campaign_id,
    processed_at = COALESCE(q.processed_at, d.campaign_created_at),
    status = 'campaign_created',
    updated_at = now()
FROM derived d
WHERE d.rn = 1
  AND d.source_campaign_id = q.source_campaign_id
  AND d.business_name = LOWER(COALESCE(q.business_name, q.title))
  AND q.processed_campaign_id IS NULL
  AND q.status NOT IN ('dismissed');
