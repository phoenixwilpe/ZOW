insert into companies (id, name, slug, plan, status, max_users, max_units, storage_mb, contact_name, contact_email)
values
  ('zow-internal', 'ZOW Systems', 'zow-internal', 'interno', 'active', 100, 20, 10240, 'ZOW', 'ramliw@zow.com'),
  ('company-default', 'Empresa Prueba 01', 'empresa-prueba-01', 'profesional', 'active', 50, 30, 10240, 'Cliente demo', 'cliente@zow.com')
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  plan = excluded.plan,
  status = excluded.status,
  updated_at = now();

insert into units (id, company_id, name, code, parent_unit_id, level)
values
  ('unit-zow-admin', 'zow-internal', 'Administracion SaaS ZOW', 'ZOW', '', 'principal'),
  ('unit-admin', 'company-default', 'Administracion del Sistema', 'ADM', '', 'principal'),
  ('unit-window', 'company-default', 'Recepcion Principal', 'REC', '', 'principal'),
  ('unit-legal', 'company-default', 'Asesoria Legal', 'AL', '', 'secundaria'),
  ('unit-finance', 'company-default', 'Administracion y Finanzas', 'AF', '', 'secundaria'),
  ('unit-purchases', 'company-default', 'Compras', 'COM', 'unit-finance', 'subarea'),
  ('unit-tech', 'company-default', 'Direccion de Tecnologia e Innovacion', 'DTI', '', 'secundaria')
on conflict (id) do update set
  name = excluded.name,
  code = excluded.code,
  parent_unit_id = excluded.parent_unit_id,
  level = excluded.level;

insert into saas_systems (id, name, slug, description, status)
values
  ('correspondencia', 'Correspondencia ZOW', 'correspondencia-zow', 'Recepcion, derivacion, seguimiento y archivo documental.', 'active'),
  ('ventas_almacen', 'Zow Ventas-Almacen', 'zow-ventas-almacen', 'Ventas, productos, stock, almacen e inventario.', 'active')
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  description = excluded.description,
  status = excluded.status;

insert into company_system_access (company_id, system_id, status, plan)
values
  ('company-default', 'correspondencia', 'active', 'profesional'),
  ('company-default', 'ventas_almacen', 'active', 'basico')
on conflict (company_id, system_id) do update set
  status = excluded.status,
  plan = excluded.plan,
  updated_at = now();

insert into organization_settings (id, company_id, company_name, store_name, currency)
values
  ('zow-internal', 'zow-internal', 'Panel ZOW SaaS', '', 'BOB'),
  ('company-default', 'company-default', 'Correspondencia ZOW', 'Tienda Central Demo', 'BOB')
on conflict (id) do update set
  company_name = excluded.company_name,
  store_name = excluded.store_name,
  currency = excluded.currency,
  updated_at = now();

insert into users (id, company_id, name, username, password_hash, role, unit_id, position, is_protected)
values
  ('user-zow-owner', 'zow-internal', 'Ramliw ZOW', 'ramliw@zow.com', '$2b$12$tS5Lzsy45lZnZ.fDTN43muGd1CNHNR94cZALClkaIdvccaBXmvHV2', 'zow_owner', 'unit-zow-admin', 'Duenio del SaaS', true),
  ('user-system-owner', 'company-default', 'Encargado de Sistema', 'sistema@zow.com', '$2b$12$Siam3xomyuP.RAmeB0VKa.K9PeUVPJlVuTsthK.KWAHAiDxY6fv8a', 'admin', 'unit-admin', 'Encargado de sistema', true),
  ('user-window', 'company-default', 'Recepcion Principal ZOW', 'recepcion@zow.com', '$2b$12$zrOaEUQCq6NRBt90fX6JrOQZ0iQae0cc7KJAlCfH9uwB8OSVc80e2', 'recepcion_principal', 'unit-window', 'Recepcion documental principal', false)
on conflict (id) do update set
  name = excluded.name,
  username = excluded.username,
  role = excluded.role,
  unit_id = excluded.unit_id,
  position = excluded.position,
  is_protected = excluded.is_protected;

-- Credenciales iniciales:
-- ramliw@zow.com / 2501Ramliw##
-- sistema@zow.com / ZowAdmin2026
-- recepcion@zow.com / ventanilla123
