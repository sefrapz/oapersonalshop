-- OA Personalshop uppdatering 2: chefsroll, plaggform, hörnradie. Kör i Supabase SQL Editor.
alter table staff add column if not exists role text not null default 'employee'
  check (role in ('employee','manager'));
alter table products add column if not exists shape text not null default 'tee'
  check (shape in ('jacket','hoodie','tee','pants','beanie','vest'));
alter table tenants add column if not exists radius int not null default 20;
create index if not exists orders_tenant_status on orders (tenant_id, status);
