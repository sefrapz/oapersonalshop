-- OA Personalshop — schema. Kör i Supabase SQL Editor (nytt projekt).
create extension if not exists pgcrypto;

-- Kunder: ALLT kundunikt är inställningar här — ingen kod per kund.
create table tenants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,                -- adressen: shop.oasystems.se/s/<slug>
  name text not null,
  logo_url text not null default '',        -- kundens logga (URL) — tomt = initial i färgruta
  brand_color text not null default '#7e22ce',
  welcome_text text not null default 'Välkommen till er personalshop!',
  order_model text not null default 'attest' check (order_model in ('free','attest','quota')),
  attest_threshold int not null default 0,   -- attest: order över X kr kräver godkännande (0 = alla)
  quota_type text not null default 'kr' check (quota_type in ('kr','items')),
  quota_value int not null default 1500,     -- kvot per anställd och år (kr eller antal plagg)
  approver_email text not null default '',   -- dit attestförfrågningar mejlas
  contact_email text not null default '',    -- ordernotiser (t.ex. din produktion)
  footer_lines text[] not null default '{}',
  website text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Personal: vitlista per kund. Endast dessa adresser kan logga in.
create table staff (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  email text not null,
  name text not null default '',
  used_kr int not null default 0,            -- förbrukad kvot i år
  used_items int not null default 0,
  created_at timestamptz not null default now(),
  unique (tenant_id, email)
);

-- Sortiment per kund.
create table products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  category text not null default 'Profil',
  price int not null default 0,              -- kr; med kvot i plagg kan priset vara 0
  sizes text[] not null default '{}',        -- t.ex. {S,M,L,XL} — tomt = ingen storlek
  image_url text not null default '',        -- produktbild (URL) — tomt = färgruta med initial
  color text not null default '#334155',     -- färgruta när bild saknas
  active boolean not null default true,
  sort int not null default 100,
  created_at timestamptz not null default now()
);

-- Ordrar + rader.
create table orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  staff_id uuid not null references staff(id) on delete cascade,
  ticket serial,
  status text not null default 'processing' check (status in ('pending_attest','approved','rejected','processing','ready')),
  total int not null default 0,
  note text not null default '',
  cost_center text not null default '',
  attest_token text not null default '',
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_name text not null,
  size text not null default '',
  qty int not null default 1,
  price int not null default 0
);

-- Inloggning via magic link + session.
create table login_tokens (
  token text primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  staff_id uuid not null references staff(id) on delete cascade,
  expires_at timestamptz not null,
  used boolean not null default false
);
create table sessions (
  token text primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  staff_id uuid not null references staff(id) on delete cascade,
  expires_at timestamptz not null
);

create index on staff (tenant_id);
create index on products (tenant_id, active);
create index on orders (tenant_id, status);
create index on order_items (order_id);

-- ===== Exempel: dina två första kunder (justera och kör) =====
-- insert into tenants (slug, name, brand_color, order_model, attest_threshold, approver_email, contact_email)
-- values ('acmebygg', 'Acme Bygg AB', '#1d4ed8', 'attest', 2000, 'inkop@acmebygg.se', 'info@oasystems.se');
-- insert into tenants (slug, name, brand_color, order_model, quota_type, quota_value, contact_email)
-- values ('nordicvalue', 'Nordic Value AB', '#0f766e', 'quota', 'items', 3, 'info@oasystems.se');
