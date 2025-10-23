-- availability
DO $$ BEGIN IF NOT EXISTS (
  SELECT 1 FROM pg_type WHERE typname = 'availability_status'
) THEN
  CREATE TYPE availability_status AS ENUM ('in_stock','out_of_stock','preorder');
END IF; END $$;

-- product condition
DO $$ BEGIN IF NOT EXISTS (
  SELECT 1 FROM pg_type WHERE typname = 'product_condition'
) THEN
  CREATE TYPE product_condition AS ENUM ('new','refurbished','used');
END IF; END $$;

-- visibility
DO $$ BEGIN IF NOT EXISTS (
  SELECT 1 FROM pg_type WHERE typname = 'item_visibility'
) THEN
  CREATE TYPE item_visibility AS ENUM ('public','private');
END IF; END $$;

-- sync status
DO $$ BEGIN IF NOT EXISTS (
  SELECT 1 FROM pg_type WHERE typname = 'sync_status'
) THEN
  CREATE TYPE sync_status AS ENUM ('pending','success','error');
END IF; END $$;
