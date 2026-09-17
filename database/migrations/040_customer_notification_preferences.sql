-- Migration: Customer Notification Preferences
-- Description: Create table for storing customer notification preferences

CREATE TABLE IF NOT EXISTS customer_notification_preferences (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
    
    -- Order notifications
    order_updates BOOLEAN NOT NULL DEFAULT true,
    shipping_updates BOOLEAN NOT NULL DEFAULT true,
    
    -- Engagement notifications (hearts, reviews, lists)
    heart_updates BOOLEAN NOT NULL DEFAULT true,
    review_reminders BOOLEAN NOT NULL DEFAULT true,
    review_responses BOOLEAN NOT NULL DEFAULT true,
    list_updates BOOLEAN NOT NULL DEFAULT true,
    list_reminders BOOLEAN NOT NULL DEFAULT true,
    
    -- Marketing notifications
    promotional_emails BOOLEAN NOT NULL DEFAULT false,
    recommended_products BOOLEAN NOT NULL DEFAULT true,
    price_drop_alerts BOOLEAN NOT NULL DEFAULT true,
    back_in_stock BOOLEAN NOT NULL DEFAULT true,
    
    -- SMS settings
    sms_enabled BOOLEAN NOT NULL DEFAULT false,
    sms_phone TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for customer lookup
CREATE INDEX IF NOT EXISTS idx_customer_notification_preferences_customer_id 
ON customer_notification_preferences(customer_id);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_customer_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customer_notification_preferences_updated_at
BEFORE UPDATE ON customer_notification_preferences
FOR EACH ROW
EXECUTE FUNCTION update_customer_notification_preferences_updated_at();

-- Add comment
COMMENT ON TABLE customer_notification_preferences IS 'Customer notification preferences for email, SMS, and push notifications including order updates, engagement (hearts/reviews/lists), and marketing';
