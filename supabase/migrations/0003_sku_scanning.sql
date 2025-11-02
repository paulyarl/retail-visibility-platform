-- SKU Scanning Tables with RLS
-- Created: 2025-11-01

-- ===========
-- Tables
-- ===========

create table if not exists scan_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  default_category text,
  default_price_cents integer,
  default_currency char(3) not null default 'USD',
  default_visibility text not null default 'private',
  enrichment_rules jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(tenant_id, name)
);

create index if not exists idx_scan_templates_tenant on scan_templates(tenant_id);

create table if not exists scan_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  template_id uuid references scan_templates(id) on delete set null,
  status text not null default 'active', -- active, completed, canceled
  device_type text, -- camera, usb
  scanned_count integer not null default 0,
  committed_count integer not null default 0,
  duplicate_count integer not null default 0,
  metadata jsonb,
  started_at timestamp with time zone default now(),
  completed_at timestamp with time zone
);

create index if not exists idx_scan_sessions_tenant_status on scan_sessions(tenant_id, status);
create index if not exists idx_scan_sessions_started_at on scan_sessions(started_at);

create table if not exists scan_results (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  session_id uuid not null references scan_sessions(id) on delete cascade,
  barcode text not null,
  sku text,
  raw_payload jsonb,
  status text not null default 'new', -- new, enriched, validated, committed, error
  enrichment jsonb,
  validation jsonb,
  duplicate_of uuid references scan_results(id) on delete set null,
  error text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(tenant_id, session_id, barcode)
);

create index if not exists idx_scan_results_tenant_status on scan_results(tenant_id, status, created_at);
create index if not exists idx_scan_results_session on scan_results(session_id);
create index if not exists idx_scan_results_barcode on scan_results(barcode);

create table if not exists barcode_lookup_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  barcode text not null,
  provider text, -- external provider/source used for lookup
  status text not null default 'success', -- success, miss, error
  response jsonb,
  latency_ms integer,
  error text,
  created_at timestamp with time zone default now()
);

create index if not exists idx_barcode_lookup_log_tenant on barcode_lookup_log(tenant_id, created_at);
create index if not exists idx_barcode_lookup_log_barcode on barcode_lookup_log(barcode);

-- ===========
-- RLS
-- ===========

alter table if exists scan_templates enable row level security;
alter table if exists scan_sessions enable row level security;
alter table if exists scan_results enable row level security;
alter table if exists barcode_lookup_log enable row level security;

-- Helper expression for tenant claim (inline for simplicity)
-- Expect JWT claim: { "tenant_id": "<uuid>" }

-- Policies: tenant isolation for CRUD

drop policy if exists tenant_isolation_scan_templates_select on scan_templates;
create policy tenant_isolation_scan_templates_select
  on scan_templates for select
  using ((current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid = tenant_id);

drop policy if exists tenant_isolation_scan_templates_mod on scan_templates;
create policy tenant_isolation_scan_templates_mod
  on scan_templates for all
  using ((current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid = tenant_id)
  with check ((current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid = tenant_id);


drop policy if exists tenant_isolation_scan_sessions_select on scan_sessions;
create policy tenant_isolation_scan_sessions_select
  on scan_sessions for select
  using ((current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid = tenant_id);

drop policy if exists tenant_isolation_scan_sessions_mod on scan_sessions;
create policy tenant_isolation_scan_sessions_mod
  on scan_sessions for all
  using ((current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid = tenant_id)
  with check ((current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid = tenant_id);


drop policy if exists tenant_isolation_scan_results_select on scan_results;
create policy tenant_isolation_scan_results_select
  on scan_results for select
  using ((current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid = tenant_id);

drop policy if exists tenant_isolation_scan_results_mod on scan_results;
create policy tenant_isolation_scan_results_mod
  on scan_results for all
  using ((current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid = tenant_id)
  with check ((current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid = tenant_id);


drop policy if exists tenant_isolation_barcode_lookup_log_select on barcode_lookup_log;
create policy tenant_isolation_barcode_lookup_log_select
  on barcode_lookup_log for select
  using ((current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid = tenant_id);

drop policy if exists tenant_isolation_barcode_lookup_log_mod on barcode_lookup_log;
create policy tenant_isolation_barcode_lookup_log_mod
  on barcode_lookup_log for all
  using ((current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid = tenant_id)
  with check ((current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid = tenant_id);

-- Optional: Triggers to keep updated_at fresh where used
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Attach trigger where updated_at exists
create trigger trg_scan_templates_updated_at
  before update on scan_templates
  for each row execute procedure set_updated_at();

create trigger trg_scan_results_updated_at
  before update on scan_results
  for each row execute procedure set_updated_at();
