require("dotenv").config();

const { db, initDb } = require("../backend/db");
const pg = require("../backend/pg");

initDb();

function bool(value) {
  return Boolean(Number(value || 0));
}

async function upsertRows(rows, handler) {
  for (const row of rows) await handler(row);
}

(async () => {
  const companies = db.prepare("SELECT * FROM companies").all();
  const units = db.prepare("SELECT * FROM units").all();
  const systems = db.prepare("SELECT * FROM saas_systems").all();
  const access = db.prepare("SELECT * FROM company_system_access").all();
  const settings = db.prepare("SELECT * FROM organization_settings").all();
  const users = db.prepare("SELECT * FROM users").all();

  await upsertRows(companies, (row) =>
    pg.run(
      `INSERT INTO companies (
         id, name, slug, plan, status, max_users, max_units, storage_mb,
         contact_name, contact_email, contact_phone, starts_at, ends_at, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?::company_status, ?, ?, ?, ?, ?, ?, ?, ?, ?::timestamptz, ?::timestamptz)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         slug = excluded.slug,
         plan = excluded.plan,
         status = excluded.status,
         max_users = excluded.max_users,
         max_units = excluded.max_units,
         storage_mb = excluded.storage_mb,
         contact_name = excluded.contact_name,
         contact_email = excluded.contact_email,
         contact_phone = excluded.contact_phone,
         starts_at = excluded.starts_at,
         ends_at = excluded.ends_at,
         updated_at = excluded.updated_at`,
      [
        row.id,
        row.name,
        row.slug,
        row.plan || "basico",
        row.status || "active",
        row.max_users || 10,
        row.max_units || 10,
        row.storage_mb || 1024,
        row.contact_name || "",
        row.contact_email || "",
        row.contact_phone || "",
        row.starts_at || "",
        row.ends_at || "",
        row.created_at || new Date().toISOString(),
        row.updated_at || new Date().toISOString()
      ]
    )
  );

  await upsertRows(units, (row) =>
    pg.run(
      `INSERT INTO units (id, company_id, name, code, parent_unit_id, level, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?::timestamptz)
       ON CONFLICT(id) DO UPDATE SET
         company_id = excluded.company_id,
         name = excluded.name,
         code = excluded.code,
         parent_unit_id = excluded.parent_unit_id,
         level = excluded.level,
         is_active = excluded.is_active`,
      [row.id, row.company_id || "company-default", row.name, row.code, row.parent_unit_id || "", row.level || "secundaria", bool(row.is_active ?? 1), row.created_at || new Date().toISOString()]
    )
  );

  await upsertRows(systems, (row) =>
    pg.run(
      `INSERT INTO saas_systems (id, name, slug, description, status, created_at)
       VALUES (?, ?, ?, ?, ?::system_status, ?::timestamptz)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         slug = excluded.slug,
         description = excluded.description,
         status = excluded.status`,
      [row.id, row.name, row.slug, row.description || "", row.status || "active", row.created_at || new Date().toISOString()]
    )
  );

  await upsertRows(access, (row) =>
    pg.run(
      `INSERT INTO company_system_access (company_id, system_id, status, plan, starts_at, ends_at, updated_at)
       VALUES (?, ?, ?::system_status, ?, ?, ?, ?::timestamptz)
       ON CONFLICT(company_id, system_id) DO UPDATE SET
         status = excluded.status,
         plan = excluded.plan,
         starts_at = excluded.starts_at,
         ends_at = excluded.ends_at,
         updated_at = excluded.updated_at`,
      [row.company_id, row.system_id, row.status || "active", row.plan || "basico", row.starts_at || "", row.ends_at || "", row.updated_at || new Date().toISOString()]
    )
  );

  await upsertRows(settings, (row) =>
    pg.run(
      `INSERT INTO organization_settings (
         id, company_id, company_name, store_name, currency, tax_id, phone, address, ticket_note, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::timestamptz)
       ON CONFLICT(id) DO UPDATE SET
         company_id = excluded.company_id,
         company_name = excluded.company_name,
         store_name = excluded.store_name,
         currency = excluded.currency,
         tax_id = excluded.tax_id,
         phone = excluded.phone,
         address = excluded.address,
         ticket_note = excluded.ticket_note,
         updated_at = excluded.updated_at`,
      [
        row.id,
        row.company_id || row.id,
        row.company_name || "Empresa sin configurar",
        row.store_name || "",
        row.currency || "BOB",
        row.tax_id || "",
        row.phone || "",
        row.address || "",
        row.ticket_note || "",
        row.updated_at || new Date().toISOString()
      ]
    )
  );

  await upsertRows(users, (row) =>
    pg.run(
      `INSERT INTO users (
         id, company_id, name, username, password_hash, role, unit_id, position, ci, phone, is_active, is_protected, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?::user_role, ?, ?, ?, ?, ?, ?, ?::timestamptz)
       ON CONFLICT(id) DO UPDATE SET
         company_id = excluded.company_id,
         name = excluded.name,
         username = excluded.username,
         password_hash = excluded.password_hash,
         role = excluded.role,
         unit_id = excluded.unit_id,
         position = excluded.position,
         ci = excluded.ci,
         phone = excluded.phone,
         is_active = excluded.is_active,
         is_protected = excluded.is_protected`,
      [
        row.id,
        row.company_id || "company-default",
        row.name,
        row.username,
        row.password_hash,
        row.role,
        row.unit_id,
        row.position || "",
        row.ci || "",
        row.phone || "",
        bool(row.is_active ?? 1),
        bool(row.is_protected),
        row.created_at || new Date().toISOString()
      ]
    )
  );

  console.log(
    JSON.stringify(
      {
        migrated: {
          companies: companies.length,
          units: units.length,
          systems: systems.length,
          access: access.length,
          settings: settings.length,
          users: users.length
        }
      },
      null,
      2
    )
  );
  await pg.pool.end();
})().catch(async (error) => {
  console.error(error);
  await pg.pool.end().catch(() => {});
  process.exit(1);
});
