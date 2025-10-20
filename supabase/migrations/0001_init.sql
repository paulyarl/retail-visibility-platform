create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamp with time zone default now()
);

-- Ensure Role enum exists
do $$
begin
  if not exists (select 1 from pg_type where typname = 'role') then
    create type role as enum ('ADMIN', 'STAFF', 'VIEWER');
  end if;
end $$;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  email text unique not null,
  role role not null,
  created_at timestamp with time zone default now()
);

create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  sku text not null,
  name text not null,
  price_cents integer not null,
  stock integer not null default 0,
  image_url text,
  metadata jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Each SKU must be unique within a tenant
create unique index if not exists uq_inventory_items_tenant_sku on inventory_items(tenant_id, sku);
create index if not exists idx_inventory_items_tenant_updated on inventory_items(tenant_id, updated_at);

create table if not exists photo_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  url text not null,
  width integer,
  height integer,
  content_type text,
  bytes integer,
  exif_removed boolean not null default true,
  captured_at timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  metadata jsonb
);

create index if not exists idx_photo_assets_tenant_item on photo_assets(tenant_id, inventory_item_id);
create index if not exists idx_photo_assets_captured_at on photo_assets(captured_at);

create table if not exists sync_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  target text not null,
  status text not null default 'queued',
  attempt integer not null default 0,
  payload jsonb not null,
  last_error text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists idx_sync_jobs_tenant_status_updated on sync_jobs(tenant_id, status, updated_at);

alter table tenants enable row level security;
alter table users enable row level security;
alter table inventory_items enable row level security;
alter table photo_assets enable row level security;
alter table sync_jobs enable row level security;

-- Example policy for tenant isolation using JWT claim tenant_id (customize per your auth setup)
-- create policy "tenant_isolation_users"
--   on users for select using (
--     (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid = tenant_id
--   );
