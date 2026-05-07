-- Drop table if exists (to start fresh)
DROP TABLE IF EXISTS account_deletion_requests;

-- Create account_deletion_requests table (minimal, no constraints)
CREATE TABLE account_deletion_requests (
    id TEXT,
    user_id TEXT,
    reason TEXT,
    status TEXT,
    requested_at TIMESTAMP WITH TIME ZONE,
    scheduled_deletion_date TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    ip_address TEXT,
    admin_notes TEXT,
    cancelled_by_admin BOOLEAN,
    preserve_data BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better performance
CREATE INDEX idx_account_deletion_requests_user_id ON account_deletion_requests(user_id);
CREATE INDEX idx_account_deletion_requests_status ON account_deletion_requests(status);
CREATE INDEX idx_account_deletion_requests_requested_at ON account_deletion_requests(requested_at DESC);
CREATE INDEX idx_account_deletion_requests_scheduled_deletion_date ON account_deletion_requests(scheduled_deletion_date);

-- Add comment
COMMENT ON TABLE account_deletion_requests IS 'Stores user account deletion requests with 30-day grace period';
COMMENT ON COLUMN account_deletion_requests.status IS 'Current status of the deletion request';
COMMENT ON COLUMN account_deletion_requests.scheduled_deletion_date IS 'Date when account will be permanently deleted';
COMMENT ON COLUMN account_deletion_requests.cancelled_at IS 'When the request was cancelled';
COMMENT ON COLUMN account_deletion_requests.completed_at IS 'When the account was actually deleted';
COMMENT ON COLUMN account_deletion_requests.admin_notes IS 'Notes added by administrators';
