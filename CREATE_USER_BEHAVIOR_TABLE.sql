-- Create user_behavior_simple table for recommendation system
-- This table tracks user interactions for personalized recommendations

CREATE TABLE IF NOT EXISTS user_behavior_simple (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(255),
    session_id VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) NOT NULL, -- 'store', 'category', 'store_type', 'product', 'search'
    entity_id VARCHAR(255) NOT NULL,
    entity_name VARCHAR(255),
    context JSONB, -- Additional context like category_slug, store_type_slug, view_mode, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    location_country VARCHAR(2),
    location_region VARCHAR(100),
    referrer VARCHAR(500),
    user_agent TEXT,
    ip_address INET,
    duration_seconds INTEGER, -- Time spent on page
    page_type VARCHAR(50) -- 'directory_home', 'directory_detail', 'storefront', 'product_page'
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_behavior_user_session ON user_behavior_simple(user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_user_behavior_entity ON user_behavior_simple(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_user_behavior_created_at ON user_behavior_simple(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_behavior_context ON user_behavior_simple USING GIN(context);
CREATE INDEX IF NOT EXISTS idx_user_behavior_location ON user_behavior_simple(location_country, location_region);

-- Add comments for documentation
COMMENT ON TABLE user_behavior_simple IS 'Tracks user behavior for personalized recommendations';
COMMENT ON COLUMN user_behavior_simple.entity_type IS 'Type of entity: store, category, store_type, product, search';
COMMENT ON COLUMN user_behavior_simple.context IS 'JSON context: category_slug, store_type_slug, view_mode, search_params, click_source';
COMMENT ON COLUMN user_behavior_simple.page_type IS 'Page type: directory_home, directory_detail, storefront, product_page';
