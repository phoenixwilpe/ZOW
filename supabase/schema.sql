create extension if not exists pgcrypto;

do $$ begin
  create type user_role as enum (
    'zow_owner',
    'admin',
    'recepcion_principal',
    'recepcion_secundaria',
    'funcionario',
    'supervisor',
    'ventas_admin',
    'cajero',
    'almacen',
    'vendedor'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type company_status as enum ('active', 'suspended', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type system_status as enum ('active', 'inactive');
exception when duplicate_object then null;
end $$;

create table if not exists companies (
  id text primary key,
  name text not null,
  slug text not null unique,
  plan text not null default 'basico',
  billing_period text not null default 'mensual',
  status company_status not null default 'active',
  max_users integer not null default 10,
  max_units integer not null default 10,
  storage_mb integer not null default 1024,
  contact_name text not null default '',
  contact_email text not null default '',
  contact_phone text not null default '',
  starts_at text not null default '',
  ends_at text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists units (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  name text not null,
  code text not null,
  parent_unit_id text,
  level text not null default 'secundaria',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, name),
  unique (company_id, code)
);

create table if not exists users (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  name text not null,
  username text not null unique,
  password_hash text not null,
  role user_role not null,
  unit_id text not null references units(id),
  position text not null default '',
  ci text not null default '',
  phone text not null default '',
  cash_register_number integer not null default 0,
  is_active boolean not null default true,
  is_protected boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists organization_settings (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  company_name text not null default 'Empresa sin configurar',
  store_name text not null default '',
  currency text not null default 'BOB',
  tax_id text not null default '',
  phone text not null default '',
  address text not null default '',
  ticket_note text not null default '',
  cash_register_count integer not null default 1,
  tax_rate numeric not null default 0,
  allow_credit boolean not null default true,
  allow_discounts boolean not null default true,
  require_customer_sale boolean not null default false,
  logo_bucket text not null default '',
  logo_path text not null default '',
  logo_name text not null default '',
  logo_mime text not null default '',
  logo_updated_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists saas_systems (
  id text primary key,
  name text not null,
  slug text not null unique,
  description text not null default '',
  status system_status not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists company_system_access (
  company_id text not null references companies(id) on delete cascade,
  system_id text not null references saas_systems(id) on delete cascade,
  status system_status not null default 'active',
  plan text not null default 'basico',
  starts_at text not null default '',
  ends_at text not null default '',
  updated_at timestamptz not null default now(),
  primary key (company_id, system_id)
);

create table if not exists documents (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  direction text not null check (direction in ('Entrante', 'Saliente')),
  year text not null,
  type text not null,
  code text not null,
  internal_number text not null default '',
  reference text not null,
  subject text not null,
  sender text not null,
  receiver text not null,
  source_unit_id text,
  target_unit_id text,
  current_unit_id text not null references units(id),
  created_by_unit_id text not null references units(id),
  owner_name text not null,
  priority text not null default 'Normal',
  status text not null,
  due_date text not null,
  has_digital_file boolean not null default false,
  digital_file_name text not null default '',
  digital_file_path text not null default '',
  digital_file_size integer not null default 0,
  digital_attached_at text not null default '',
  physical_received boolean not null default false,
  created_by text not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  applicant_name text not null default '',
  applicant_ci text not null default '',
  applicant_phone text not null default '',
  sheet_count integer not null default 0,
  received_at text not null default '',
  unique (company_id, code)
);

create table if not exists movements (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  document_id text not null references documents(id) on delete cascade,
  from_unit_id text references units(id),
  to_unit_id text references units(id),
  instruction_type text not null,
  due_days integer not null default 0,
  comment text not null default '',
  status text not null,
  created_by text not null references users(id),
  derived_at timestamptz not null default now()
);

create table if not exists document_recipients (
  company_id text not null references companies(id) on delete cascade,
  document_id text not null references documents(id) on delete cascade,
  unit_id text not null references units(id),
  status text not null default 'Pendiente',
  received_at timestamptz not null default now(),
  primary key (document_id, unit_id)
);

create table if not exists document_files (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  document_id text not null references documents(id) on delete cascade,
  original_name text not null,
  stored_name text not null,
  storage_bucket text not null default 'documentos',
  storage_path text not null default '',
  size integer not null default 0,
  mime_type text not null default '',
  uploaded_by text not null references users(id),
  uploaded_at timestamptz not null default now()
);

create table if not exists public_lookup_audit (
  id text primary key,
  company_id text,
  document_id text,
  code text not null default '',
  ci_hash text not null default '',
  ip_address text not null default '',
  user_agent text not null default '',
  found boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists audit_events (
  id text primary key,
  company_id text,
  actor_user_id text,
  actor_name text not null default '',
  action text not null,
  entity_type text not null default '',
  entity_id text not null default '',
  description text not null default '',
  metadata text not null default '',
  ip_address text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists leads (
  id text primary key,
  name text not null,
  company text not null default '',
  phone text not null default '',
  email text not null default '',
  system_id text not null default '',
  plan text not null default '',
  message text not null default '',
  notes text not null default '',
  next_action text not null default '',
  next_action_at text not null default '',
  priority text not null default 'media',
  status text not null default 'nuevo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists lead_history (
  id text primary key,
  lead_id text not null references leads(id) on delete cascade,
  actor_user_id text,
  actor_name text not null default '',
  status text not null default '',
  priority text not null default '',
  next_action text not null default '',
  next_action_at text not null default '',
  notes text not null default '',
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists inventory_products (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  code text not null,
  name text not null,
  category text not null default '',
  unit text not null default 'Unidad',
  cost_price numeric not null default 0,
  sale_price numeric not null default 0,
  min_stock numeric not null default 0,
  stock numeric not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code)
);

create table if not exists inventory_categories (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  name text not null,
  description text not null default '',
  unique (company_id, name)
);

create table if not exists sales_customers (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  name text not null,
  phone text not null default '',
  ci text not null default '',
  email text not null default '',
  address text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sales_orders (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  code text not null,
  customer_id text references sales_customers(id),
  customer_name text not null default '',
  subtotal numeric not null default 0,
  discount numeric not null default 0,
  tax numeric not null default 0,
  total numeric not null default 0,
  note text not null default '',
  cash_received numeric not null default 0,
  change_amount numeric not null default 0,
  payment_method text not null default 'efectivo',
  payment_detail text not null default '',
  amount_paid numeric not null default 0,
  balance_due numeric not null default 0,
  payment_status text not null default 'pagada',
  status text not null default 'confirmada',
  cash_closed boolean not null default false,
  created_by text not null references users(id),
  created_at timestamptz not null default now(),
  unique (company_id, code)
);

create table if not exists sales_order_items (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  sale_id text not null references sales_orders(id) on delete cascade,
  product_id text references inventory_products(id),
  product_name text not null,
  quantity numeric not null default 0,
  unit_price numeric not null default 0,
  total numeric not null default 0
);

create table if not exists cash_closures (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  code text not null,
  register_number integer not null default 1,
  opening_amount numeric not null default 0,
  total_sales numeric not null default 0,
  movement_total numeric not null default 0,
  expected_amount numeric not null default 0,
  counted_amount numeric not null default 0,
  difference_amount numeric not null default 0,
  sale_count integer not null default 0,
  created_by text not null references users(id),
  created_at timestamptz not null default now(),
  unique (company_id, code)
);

create table if not exists cash_sessions (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  opened_by text not null references users(id),
  register_number integer not null default 1,
  opening_amount numeric not null default 0,
  status text not null default 'abierta',
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists cash_movements (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  session_id text not null references cash_sessions(id) on delete cascade,
  type text not null,
  amount numeric not null default 0,
  reason text not null default '',
  created_by text not null references users(id),
  created_at timestamptz not null default now()
);

create table if not exists inventory_movements (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  product_id text not null references inventory_products(id) on delete cascade,
  type text not null,
  quantity numeric not null default 0,
  reference text not null default '',
  note text not null default '',
  created_by text not null references users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_users_company on users(company_id);
create index if not exists idx_units_company on units(company_id);
create index if not exists idx_documents_company on documents(company_id);
create index if not exists idx_documents_current_unit on documents(current_unit_id);
create index if not exists idx_movements_document on movements(document_id);
create index if not exists idx_document_recipients_unit on document_recipients(company_id, unit_id);
create index if not exists idx_public_lookup_audit_created on public_lookup_audit(created_at);
create index if not exists idx_public_lookup_audit_company on public_lookup_audit(company_id);
create index if not exists idx_audit_events_company on audit_events(company_id, created_at desc);
create index if not exists idx_audit_events_action on audit_events(action);
create index if not exists idx_leads_status on leads(status, created_at desc);
create index if not exists idx_leads_priority on leads(priority, created_at desc);
create index if not exists idx_lead_history_lead on lead_history(lead_id, created_at desc);
create index if not exists idx_inventory_products_company on inventory_products(company_id, name);
create index if not exists idx_sales_orders_company on sales_orders(company_id, created_at desc);
create index if not exists idx_cash_sessions_company on cash_sessions(company_id, status, opened_at);
create index if not exists idx_cash_movements_session on cash_movements(session_id, created_at);
create index if not exists idx_inventory_movements_product on inventory_movements(product_id, created_at desc);

alter table companies enable row level security;
alter table units enable row level security;
alter table users enable row level security;
alter table organization_settings enable row level security;
alter table saas_systems enable row level security;
alter table company_system_access enable row level security;
alter table documents enable row level security;
alter table movements enable row level security;
alter table document_recipients enable row level security;
alter table document_files enable row level security;
alter table inventory_products enable row level security;
alter table inventory_categories enable row level security;
alter table sales_customers enable row level security;
alter table sales_orders enable row level security;
alter table sales_order_items enable row level security;
alter table cash_closures enable row level security;
alter table cash_sessions enable row level security;
alter table cash_movements enable row level security;
alter table inventory_movements enable row level security;

-- El backend de Vercel usara SUPABASE_SERVICE_ROLE_KEY, por eso RLS no bloquea al servidor.
-- Cuando pasemos auth directa de Supabase al frontend, agregaremos politicas por JWT/company_id.
