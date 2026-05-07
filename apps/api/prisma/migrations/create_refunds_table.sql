-- Create refunds table
CREATE TABLE IF NOT EXISTS refunds (
  id VARCHAR(255) PRIMARY KEY,
  payment_id VARCHAR(255) NOT NULL,
  order_id VARCHAR(255) NOT NULL,
  tenant_id VARCHAR(255) NOT NULL,
  
  -- Refund details
  amount_cents INTEGER NOT NULL,
  refund_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  refund_reason TEXT,
  
  -- Gateway information
  gateway_type VARCHAR(50) NOT NULL,
  gateway_refund_id VARCHAR(255),
  gateway_response JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Metadata
  initiated_by VARCHAR(255),
  metadata JSONB,
  
  -- Foreign keys
  CONSTRAINT fk_refunds_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
  CONSTRAINT fk_refunds_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_refunds_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_tenant_id ON refunds(tenant_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(refund_status);
CREATE INDEX IF NOT EXISTS idx_refunds_created_at ON refunds(created_at DESC);

-- Add comment
COMMENT ON TABLE refunds IS 'Tracks refund transactions for cancelled orders';
