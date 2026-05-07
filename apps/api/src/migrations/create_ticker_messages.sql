-- Create ticker_messages table for enhanced platform notification system
-- This migration adds support for multiple messages, scheduling, and advanced targeting
-- Follows platform naming standards: snake_case_plural

CREATE TABLE IF NOT EXISTS ticker_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message TEXT NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('info', 'warning', 'success', 'error')),
    icon VARCHAR(20) NOT NULL CHECK (icon IN ('info', 'warning', 'success', 'bulb')),
    is_scrolling BOOLEAN DEFAULT false,
    is_dismissible BOOLEAN DEFAULT true,
    target_audience VARCHAR(20) NOT NULL CHECK (target_audience IN ('all', 'specific_tiers', 'specific_tenants')),
    target_tiers TEXT[], -- Array of tier names
    target_tenants TEXT[], -- Array of tenant IDs
    start_date TIMESTAMP WITH TIME ZONE, -- When message should start showing
    end_date TIMESTAMP WITH TIME ZONE,   -- When message should stop showing
    priority INTEGER DEFAULT 1 CHECK (priority >= 1 AND priority <= 10),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT -- Changed from UUID to TEXT to match users.id type
);

-- Create ticker_configs table for global settings (plural form per standards)
CREATE TABLE IF NOT EXISTS ticker_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_enabled BOOLEAN DEFAULT false,
    max_messages INTEGER DEFAULT 3 CHECK (max_messages >= 1 AND max_messages <= 10),
    scroll_speed VARCHAR(10) DEFAULT 'medium' CHECK (scroll_speed IN ('slow', 'medium', 'fast')),
    is_auto_rotate BOOLEAN DEFAULT true,
    rotation_interval INTEGER DEFAULT 5 CHECK (rotation_interval >= 3 AND rotation_interval <= 60),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT -- Changed from UUID to TEXT to match users.id type
);

-- Insert default configuration
INSERT INTO ticker_configs (is_enabled, max_messages, scroll_speed, is_auto_rotate, rotation_interval)
VALUES (false, 3, 'medium', true, 5)
ON CONFLICT DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ticker_messages_active_dates ON ticker_messages (is_active, start_date, end_date) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_ticker_messages_priority ON ticker_messages (priority DESC, created_at DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_ticker_messages_target_tiers ON ticker_messages USING GIN (target_tiers) WHERE target_audience = 'specific_tiers';
CREATE INDEX IF NOT EXISTS idx_ticker_messages_target_tenants ON ticker_messages USING GIN (target_tenants) WHERE target_audience = 'specific_tenants';
CREATE INDEX IF NOT EXISTS idx_ticker_messages_type ON ticker_messages (type);

-- Create function to get active messages for a specific tenant
CREATE OR REPLACE FUNCTION get_active_ticker_messages(
    p_tenant_id TEXT DEFAULT NULL,
    p_tenant_tier TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    message TEXT,
    type VARCHAR(20),
    icon VARCHAR(20),
    is_scrolling BOOLEAN,
    is_dismissible BOOLEAN,
    priority INTEGER,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tm.id,
        tm.message,
        tm.type,
        tm.icon,
        tm.is_scrolling,
        tm.is_dismissible,
        tm.priority,
        tm.start_date,
        tm.end_date,
        tm.is_active
    FROM ticker_messages tm
    WHERE tm.is_active = true
    AND (
        tm.start_date IS NULL OR tm.start_date <= NOW()
    )
    AND (
        tm.end_date IS NULL OR tm.end_date >= NOW()
    )
    AND (
        tm.target_audience = 'all'
        OR (tm.target_audience = 'specific_tiers' AND p_tenant_tier IS NOT NULL AND p_tenant_tier = ANY(tm.target_tiers))
        OR (tm.target_audience = 'specific_tenants' AND p_tenant_id IS NOT NULL AND p_tenant_id = ANY(tm.target_tenants))
    )
    ORDER BY tm.priority DESC, tm.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_ticker_messages_updated_at 
    BEFORE UPDATE ON ticker_messages 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ticker_configs_updated_at 
    BEFORE UPDATE ON ticker_configs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions (adjust based on your database user setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ticker_messages TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ticker_configs TO your_app_user;
-- GRANT EXECUTE ON FUNCTION get_active_ticker_messages TO your_app_user;

-- Comments for documentation
COMMENT ON TABLE ticker_messages IS 'Stores individual ticker messages with scheduling and targeting options';
COMMENT ON TABLE ticker_configs IS 'Stores global ticker configuration settings';
COMMENT ON COLUMN ticker_messages.target_tiers IS 'Array of subscription tier names to target';
COMMENT ON COLUMN ticker_messages.target_tenants IS 'Array of tenant IDs to target';
COMMENT ON COLUMN ticker_messages.start_date IS 'When the message should start being displayed';
COMMENT ON COLUMN ticker_messages.end_date IS 'When the message should stop being displayed';
COMMENT ON COLUMN ticker_messages.priority IS 'Display priority (1-10, higher = more important)';
COMMENT ON COLUMN ticker_configs.scroll_speed IS 'Animation speed for scrolling messages';
COMMENT ON COLUMN ticker_configs.rotation_interval IS 'Seconds between message rotations';
