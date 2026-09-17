-- 066_bot_knowledge_embeddings.sql
-- Unified knowledge embedding table for bot RAG across multiple source types.
-- Replaces fragile keyword-gated context injection with semantic search.

CREATE TABLE IF NOT EXISTS bot_knowledge_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(255) NOT NULL,
  source_type VARCHAR(50) NOT NULL,
  source_id VARCHAR(255) NOT NULL,
  chunk_text TEXT NOT NULL,
  chunk_index INT NOT NULL DEFAULT 0,
  embedding vector(1536),
  model VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, source_type, source_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_bot_knowledge_tenant ON bot_knowledge_embeddings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bot_knowledge_source ON bot_knowledge_embeddings(tenant_id, source_type);

-- ivfflat index for cosine similarity search
CREATE INDEX IF NOT EXISTS idx_bot_knowledge_embedding
  ON bot_knowledge_embeddings USING ivfflat(embedding vector_cosine_ops)
  WITH (lists = 100);

-- updated_at trigger
CREATE OR REPLACE FUNCTION trg_bot_knowledge_embeddings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_bot_knowledge_embeddings ON bot_knowledge_embeddings;
CREATE TRIGGER set_updated_at_bot_knowledge_embeddings
  BEFORE UPDATE ON bot_knowledge_embeddings
  FOR EACH ROW EXECUTE FUNCTION trg_bot_knowledge_embeddings_updated_at();

-- RLS policies
ALTER TABLE bot_knowledge_embeddings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY bot_knowledge_embeddings_tenant_isolation ON bot_knowledge_embeddings
    USING (tenant_id = current_setting('app.current_tenant_id', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY bot_knowledge_embeddings_admin_all ON bot_knowledge_embeddings
    FOR ALL TO authenticated
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
