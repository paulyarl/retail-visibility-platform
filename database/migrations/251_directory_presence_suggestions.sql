-- Migration 251: Directory Presence Public Suggestions Queue
--
-- Adds a global operator-review queue for public suggestions of missing
-- directory businesses. Suggestions are not published until an operator
-- approves and converts them into a directory_presence_seed.
--
-- After running: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate

CREATE TABLE IF NOT EXISTS directory_presence_suggestions (
    id                  VARCHAR(60) PRIMARY KEY,
    business_name       VARCHAR(255) NOT NULL,
    address             VARCHAR(255),
    city                VARCHAR(100),
    state               VARCHAR(50),
    zip_code            VARCHAR(20),
    phone               VARCHAR(40),
    primary_category    VARCHAR(120),
    submitter_email     VARCHAR(255),
    submitter_ip        VARCHAR(64),
    submitter_comment   VARCHAR(1000),
    source_page         VARCHAR(500),
    status              VARCHAR(32) NOT NULL DEFAULT 'submitted'
                        CHECK (status IN ('submitted', 'under_review', 'approved', 'rejected', 'duplicate')),
    reviewed_by         VARCHAR(255),
    reviewed_at         TIMESTAMPTZ,
    seed_id             VARCHAR(60),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_dpsg_seed FOREIGN KEY (seed_id) REFERENCES directory_presence_seeds(id) ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_dpsg_status ON directory_presence_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_dpsg_city ON directory_presence_suggestions(city);
CREATE INDEX IF NOT EXISTS idx_dpsg_state ON directory_presence_suggestions(state);
CREATE INDEX IF NOT EXISTS idx_dpsg_category ON directory_presence_suggestions(primary_category);
CREATE INDEX IF NOT EXISTS idx_dpsg_created_at ON directory_presence_suggestions(created_at);
CREATE INDEX IF NOT EXISTS idx_dpsg_submitter_ip ON directory_presence_suggestions(submitter_ip);
CREATE INDEX IF NOT EXISTS idx_dpsg_submitter_email ON directory_presence_suggestions(submitter_email);
