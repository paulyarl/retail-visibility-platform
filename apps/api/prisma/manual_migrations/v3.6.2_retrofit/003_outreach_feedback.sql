-- Migration: 003_outreach_feedback.sql
-- Description: Create outreach_feedback table for pilot feedback collection
-- Version: v3.6.2-prep (Retrofit R8)
-- Date: 2025-10-31

-- Create outreach_feedback table
CREATE TABLE IF NOT EXISTS outreach_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenant(id) ON DELETE CASCADE,
  user_id uuid REFERENCES "user"(id) ON DELETE SET NULL,
  feedback jsonb NOT NULL,
  score integer NOT NULL,
  category text,                  -- 'usability', 'performance', 'features', 'support'
  context text,                   -- 'onboarding', 'category_alignment', 'feed_push', etc.
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT score_range CHECK (score BETWEEN 1 AND 5),
  CONSTRAINT feedback_not_empty CHECK (jsonb_typeof(feedback) = 'object')
);

-- Create indexes
CREATE INDEX idx_feedback_tenant ON outreach_feedback(tenant_id, created_at DESC);
CREATE INDEX idx_feedback_score ON outreach_feedback(score);
CREATE INDEX idx_feedback_category ON outreach_feedback(category) WHERE category IS NOT NULL;
CREATE INDEX idx_feedback_context ON outreach_feedback(context) WHERE context IS NOT NULL;
CREATE INDEX idx_feedback_created ON outreach_feedback(created_at DESC);

-- GIN index for feedback JSONB queries
CREATE INDEX idx_feedback_content ON outreach_feedback USING GIN(feedback);

-- Add comments
COMMENT ON TABLE outreach_feedback IS 'User feedback collection for pilot program and continuous improvement';
COMMENT ON COLUMN outreach_feedback.score IS 'Rating from 1 (poor) to 5 (excellent)';
COMMENT ON COLUMN outreach_feedback.feedback IS 'Structured feedback: {comment, features_used, pain_points, suggestions}';
COMMENT ON COLUMN outreach_feedback.category IS 'Feedback category: usability, performance, features, support';
COMMENT ON COLUMN outreach_feedback.context IS 'Context where feedback was collected: onboarding, category_alignment, etc.';

-- Enable Row Level Security
ALTER TABLE outreach_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can see their own tenant's feedback
DROP POLICY IF EXISTS feedback_tenant_isolation ON outreach_feedback;
CREATE POLICY feedback_tenant_isolation ON outreach_feedback
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_user WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Users can insert feedback for their tenant
DROP POLICY IF EXISTS feedback_insert_own_tenant ON outreach_feedback;
CREATE POLICY feedback_insert_own_tenant ON outreach_feedback
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_user WHERE user_id = auth.uid()
    )
  );

-- Function to submit feedback
CREATE OR REPLACE FUNCTION submit_feedback(
  p_tenant_id uuid,
  p_feedback jsonb,
  p_score integer,
  p_category text DEFAULT NULL,
  p_context text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_feedback_id uuid;
  v_user_id uuid;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  -- Validate score
  IF p_score < 1 OR p_score > 5 THEN
    RAISE EXCEPTION 'Score must be between 1 and 5';
  END IF;
  
  -- Insert feedback
  INSERT INTO outreach_feedback (
    tenant_id,
    user_id,
    feedback,
    score,
    category,
    context
  ) VALUES (
    p_tenant_id,
    v_user_id,
    p_feedback,
    p_score,
    p_category,
    p_context
  ) RETURNING id INTO v_feedback_id;
  
  -- Log to audit trail
  PERFORM log_audit_event(
    p_tenant_id,
    'feedback',
    v_feedback_id::text,
    'create',
    v_user_id,
    NULL,
    jsonb_build_object(
      'score', p_score,
      'category', p_category,
      'context', p_context
    ),
    NULL
  );
  
  RETURN v_feedback_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION submit_feedback TO authenticated;

-- Create view for feedback analytics
CREATE OR REPLACE VIEW feedback_analytics AS
SELECT 
  tenant_id,
  COUNT(*) as total_feedback,
  AVG(score) as avg_score,
  ROUND(AVG(score), 2) as avg_score_rounded,
  COUNT(*) FILTER (WHERE score >= 4) as positive_count,
  COUNT(*) FILTER (WHERE score <= 2) as negative_count,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE score >= 4) / NULLIF(COUNT(*), 0),
    2
  ) as satisfaction_rate_pct,
  jsonb_agg(
    jsonb_build_object(
      'score', score,
      'category', category,
      'context', context,
      'created_at', created_at
    ) ORDER BY created_at DESC
  ) FILTER (WHERE created_at >= now() - interval '30 days') as recent_feedback
FROM outreach_feedback
GROUP BY tenant_id;

COMMENT ON VIEW feedback_analytics IS 'Aggregated feedback metrics by tenant';

-- Create view for pilot program KPIs
CREATE OR REPLACE VIEW pilot_program_kpis AS
SELECT 
  t.id as tenant_id,
  t.name as tenant_name,
  fa.total_feedback,
  fa.avg_score_rounded,
  fa.satisfaction_rate_pct,
  
  -- Feed accuracy (from feed_push_jobs)
  ROUND(
    100.0 * COUNT(fpj.id) FILTER (WHERE fpj.job_status = 'success') / 
    NULLIF(COUNT(fpj.id), 0),
    2
  ) as feed_accuracy_pct,
  
  -- Category mapping coverage
  ROUND(
    100.0 * COUNT(tc.id) FILTER (WHERE tc.google_category_id IS NOT NULL) /
    NULLIF(COUNT(tc.id), 0),
    2
  ) as mapping_coverage_pct,
  
  -- Quick Actions engagement (from audit_log)
  COUNT(al.id) FILTER (WHERE al.entity = 'quick_action') as qa_engagement_count,
  
  -- Time to alignment (median from audit_log)
  PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY EXTRACT(EPOCH FROM (al.timestamp - al.metadata->>'started_at')::interval)
  ) FILTER (WHERE al.action = 'align' AND al.metadata->>'started_at' IS NOT NULL) as median_alignment_time_seconds

FROM tenant t
LEFT JOIN feedback_analytics fa ON fa.tenant_id = t.id
LEFT JOIN feed_push_jobs fpj ON fpj.tenant_id = t.id 
  AND fpj.created_at >= now() - interval '30 days'
LEFT JOIN tenant_category tc ON tc.tenant_id = t.id AND tc.is_active = true
LEFT JOIN audit_log al ON al.tenant_id = t.id 
  AND al.timestamp >= now() - interval '30 days'
GROUP BY t.id, t.name, fa.total_feedback, fa.avg_score_rounded, fa.satisfaction_rate_pct;

COMMENT ON VIEW pilot_program_kpis IS 'Pilot program KPIs: satisfaction ≥80%, feed accuracy ≥90%, engagement ≥60%';
