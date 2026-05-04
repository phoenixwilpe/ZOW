const { DatabaseSync } = require("node:sqlite");
const bcrypt = require("bcryptjs");
const path = require("node:path");
const fs = require("node:fs");
const { randomUUID } = require("node:crypto");

const dataDir = process.env.SQLITE_DIR || (process.env.VERCEL ? "/tmp/zow-data" : path.join(__dirname, "..", "data"));
fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(process.env.SQLITE_PATH || path.join(dataDir, "zow-correspondencia.sqlite"));
db.exec("PRAGMA foreign_keys = ON");

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS units (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL DEFAULT 'company-default',
      name TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL UNIQUE,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL DEFAULT 'company-default',
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('zow_owner', 'admin', 'recepcion_principal', 'recepcion_secundaria', 'funcionario', 'supervisor', 'ventas_admin', 'cajero', 'almacen', 'vendedor')),
      unit_id TEXT NOT NULL,
      position TEXT NOT NULL DEFAULT '',
      cash_register_number INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      is_protected INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (unit_id) REFERENCES units(id)
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL DEFAULT 'company-default',
      direction TEXT NOT NULL CHECK (direction IN ('Entrante', 'Saliente')),
      year TEXT NOT NULL,
      type TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      internal_number TEXT NOT NULL DEFAULT '',
      reference TEXT NOT NULL,
      subject TEXT NOT NULL,
      sender TEXT NOT NULL,
      receiver TEXT NOT NULL,
      source_unit_id TEXT,
      target_unit_id TEXT,
      current_unit_id TEXT NOT NULL,
      created_by_unit_id TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'Normal',
      status TEXT NOT NULL,
      due_date TEXT NOT NULL,
      has_digital_file INTEGER NOT NULL DEFAULT 0,
      digital_file_name TEXT NOT NULL DEFAULT '',
      digital_file_path TEXT NOT NULL DEFAULT '',
      digital_file_size INTEGER NOT NULL DEFAULT 0,
      digital_attached_at TEXT NOT NULL DEFAULT '',
      physical_received INTEGER NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (current_unit_id) REFERENCES units(id),
      FOREIGN KEY (created_by_unit_id) REFERENCES units(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS movements (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL DEFAULT 'company-default',
      document_id TEXT NOT NULL,
      from_unit_id TEXT,
      to_unit_id TEXT,
      instruction_type TEXT NOT NULL,
      due_days INTEGER NOT NULL DEFAULT 0,
      comment TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      created_by TEXT NOT NULL,
      derived_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (from_unit_id) REFERENCES units(id),
      FOREIGN KEY (to_unit_id) REFERENCES units(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS document_recipients (
      company_id TEXT NOT NULL DEFAULT 'company-default',
      document_id TEXT NOT NULL,
      unit_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pendiente',
      received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (document_id, unit_id),
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (unit_id) REFERENCES units(id)
    );

    CREATE TABLE IF NOT EXISTS document_files (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL DEFAULT 'company-default',
      document_id TEXT NOT NULL,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      size INTEGER NOT NULL DEFAULT 0,
      mime_type TEXT NOT NULL DEFAULT '',
      uploaded_by TEXT NOT NULL,
      uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS public_lookup_audit (
      id TEXT PRIMARY KEY,
      company_id TEXT,
      document_id TEXT,
      code TEXT NOT NULL DEFAULT '',
      ci_hash TEXT NOT NULL DEFAULT '',
      ip_address TEXT NOT NULL DEFAULT '',
      user_agent TEXT NOT NULL DEFAULT '',
      found INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      company_id TEXT,
      actor_user_id TEXT,
      actor_name TEXT NOT NULL DEFAULT '',
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL DEFAULT '',
      entity_id TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      metadata TEXT NOT NULL DEFAULT '',
      ip_address TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      company TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      system_id TEXT NOT NULL DEFAULT '',
      plan TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      next_action TEXT NOT NULL DEFAULT '',
      next_action_at TEXT NOT NULL DEFAULT '',
      priority TEXT NOT NULL DEFAULT 'media',
      status TEXT NOT NULL DEFAULT 'nuevo',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lead_history (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      actor_user_id TEXT,
      actor_name TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT '',
      priority TEXT NOT NULL DEFAULT '',
      next_action TEXT NOT NULL DEFAULT '',
      next_action_at TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS organization_settings (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL DEFAULT 'company-default',
      company_name TEXT NOT NULL DEFAULT 'Empresa sin configurar',
      store_name TEXT NOT NULL DEFAULT '',
      currency TEXT NOT NULL DEFAULT 'BOB',
      tax_id TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      ticket_note TEXT NOT NULL DEFAULT '',
      cash_register_count INTEGER NOT NULL DEFAULT 1,
      logo_bucket TEXT NOT NULL DEFAULT '',
      logo_path TEXT NOT NULL DEFAULT '',
      logo_name TEXT NOT NULL DEFAULT '',
      logo_mime TEXT NOT NULL DEFAULT '',
      logo_updated_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      plan TEXT NOT NULL DEFAULT 'basico',
      billing_period TEXT NOT NULL DEFAULT 'mensual',
      status TEXT NOT NULL DEFAULT 'active',
      max_users INTEGER NOT NULL DEFAULT 10,
      max_units INTEGER NOT NULL DEFAULT 10,
      storage_mb INTEGER NOT NULL DEFAULT 1024,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS saas_systems (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS company_system_access (
      company_id TEXT NOT NULL,
      system_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      plan TEXT NOT NULL DEFAULT 'basico',
      starts_at TEXT NOT NULL DEFAULT '',
      ends_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (company_id, system_id),
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY (system_id) REFERENCES saas_systems(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS inventory_products (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      unit TEXT NOT NULL DEFAULT 'Unidad',
      cost_price REAL NOT NULL DEFAULT 0,
      sale_price REAL NOT NULL DEFAULT 0,
      min_stock REAL NOT NULL DEFAULT 0,
      stock REAL NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (company_id, code),
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS inventory_categories (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (company_id, name),
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sales_customers (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      ci TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS purchase_suppliers (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      tax_id TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      code TEXT NOT NULL,
      supplier_id TEXT,
      supplier_name TEXT NOT NULL DEFAULT '',
      invoice_number TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      total REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'confirmada',
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (company_id, code),
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY (supplier_id) REFERENCES purchase_suppliers(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      purchase_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      unit_cost REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY (purchase_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES inventory_products(id)
    );

    CREATE TABLE IF NOT EXISTS sales_orders (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      code TEXT NOT NULL,
      customer_id TEXT,
      customer_name TEXT NOT NULL DEFAULT '',
      subtotal REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      cash_received REAL NOT NULL DEFAULT 0,
      change_amount REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL DEFAULT 'efectivo',
      amount_paid REAL NOT NULL DEFAULT 0,
      balance_due REAL NOT NULL DEFAULT 0,
      payment_status TEXT NOT NULL DEFAULT 'pagada',
      status TEXT NOT NULL DEFAULT 'confirmada',
      cash_closed INTEGER NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (company_id, code),
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES sales_customers(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sales_order_items (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      sale_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      total REAL NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY (sale_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES inventory_products(id)
    );

    CREATE TABLE IF NOT EXISTS cash_closures (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      code TEXT NOT NULL,
      opening_amount REAL NOT NULL DEFAULT 0,
      register_number INTEGER NOT NULL DEFAULT 1,
      total_sales REAL NOT NULL DEFAULT 0,
      movement_total REAL NOT NULL DEFAULT 0,
      expected_amount REAL NOT NULL DEFAULT 0,
      counted_amount REAL NOT NULL DEFAULT 0,
      difference_amount REAL NOT NULL DEFAULT 0,
      sale_count INTEGER NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (company_id, code),
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS cash_sessions (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      opened_by TEXT NOT NULL,
      register_number INTEGER NOT NULL DEFAULT 1,
      opening_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'abierta',
      opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      closed_at TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY (opened_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS cash_movements (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('ingreso', 'egreso')),
      amount REAL NOT NULL DEFAULT 0,
      reason TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY (session_id) REFERENCES cash_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS inventory_movements (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('entrada', 'salida', 'ajuste')),
      quantity REAL NOT NULL,
      reference TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES inventory_products(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );
  `);

  migrateSchema();
  seedBaseConfiguration();
}

function migrateSchema() {
  ensureColumn("units", "company_id", "TEXT NOT NULL DEFAULT 'company-default'");
  ensureColumn("users", "company_id", "TEXT NOT NULL DEFAULT 'company-default'");
  ensureColumn("documents", "company_id", "TEXT NOT NULL DEFAULT 'company-default'");
  ensureColumn("movements", "company_id", "TEXT NOT NULL DEFAULT 'company-default'");
  ensureColumn("document_recipients", "company_id", "TEXT NOT NULL DEFAULT 'company-default'");
  ensureColumn("document_files", "company_id", "TEXT NOT NULL DEFAULT 'company-default'");
  ensureColumn("organization_settings", "company_id", "TEXT NOT NULL DEFAULT 'company-default'");
  ensureColumn("organization_settings", "store_name", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("organization_settings", "currency", "TEXT NOT NULL DEFAULT 'BOB'");
  ensureColumn("organization_settings", "tax_id", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("organization_settings", "phone", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("organization_settings", "address", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("organization_settings", "ticket_note", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("organization_settings", "cash_register_count", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn("organization_settings", "logo_bucket", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("organization_settings", "logo_path", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("organization_settings", "logo_name", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("organization_settings", "logo_mime", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("organization_settings", "logo_updated_at", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("companies", "contact_name", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("companies", "contact_email", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("companies", "contact_phone", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("companies", "billing_period", "TEXT NOT NULL DEFAULT 'mensual'");
  ensureColumn("companies", "starts_at", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("companies", "ends_at", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("units", "parent_unit_id", "TEXT");
  ensureColumn("units", "level", "TEXT NOT NULL DEFAULT 'secundaria'");
  ensureColumn("users", "ci", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("users", "phone", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("users", "cash_register_number", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("documents", "applicant_name", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("documents", "applicant_ci", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("documents", "applicant_phone", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("documents", "sheet_count", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("documents", "received_at", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("public_lookup_audit", "user_agent", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("audit_events", "metadata", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("audit_events", "ip_address", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("leads", "status", "TEXT NOT NULL DEFAULT 'nuevo'");
  ensureColumn("leads", "notes", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("leads", "next_action", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("leads", "next_action_at", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("leads", "priority", "TEXT NOT NULL DEFAULT 'media'");
  ensureColumn("cash_closures", "opening_amount", "REAL NOT NULL DEFAULT 0");
  ensureColumn("cash_closures", "register_number", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn("cash_closures", "movement_total", "REAL NOT NULL DEFAULT 0");
  ensureColumn("cash_closures", "expected_amount", "REAL NOT NULL DEFAULT 0");
  ensureColumn("cash_closures", "counted_amount", "REAL NOT NULL DEFAULT 0");
  ensureColumn("cash_closures", "difference_amount", "REAL NOT NULL DEFAULT 0");
  ensureColumn("sales_orders", "payment_method", "TEXT NOT NULL DEFAULT 'efectivo'");
  ensureColumn("sales_orders", "amount_paid", "REAL NOT NULL DEFAULT 0");
  ensureColumn("sales_orders", "balance_due", "REAL NOT NULL DEFAULT 0");
  ensureColumn("sales_orders", "payment_status", "TEXT NOT NULL DEFAULT 'pagada'");
  ensureColumn("cash_sessions", "register_number", "INTEGER NOT NULL DEFAULT 1");
  db.prepare("UPDATE sales_orders SET amount_paid = total WHERE amount_paid = 0 AND payment_method <> 'credito' AND status <> 'anulada'").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_leads_priority ON leads(priority, created_at)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_lead_history_lead ON lead_history(lead_id, created_at)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_cash_sessions_company ON cash_sessions(company_id, status, opened_at)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_cash_movements_session ON cash_movements(session_id, created_at)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_purchase_suppliers_company ON purchase_suppliers(company_id, name)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_purchase_orders_company ON purchase_orders(company_id, created_at)").run();
  migrateTenantTables();
  db.prepare("UPDATE units SET company_id = COALESCE(NULLIF(company_id, ''), 'company-default')").run();
  db.prepare("UPDATE users SET company_id = COALESCE(NULLIF(company_id, ''), 'company-default')").run();
  db.prepare("UPDATE documents SET company_id = COALESCE(NULLIF(company_id, ''), 'company-default')").run();
  db.prepare("UPDATE movements SET company_id = COALESCE(NULLIF(company_id, ''), 'company-default')").run();
  db.prepare("UPDATE document_recipients SET company_id = COALESCE(NULLIF(company_id, ''), 'company-default')").run();
  db.prepare("UPDATE organization_settings SET company_id = COALESCE(NULLIF(company_id, ''), 'company-default')").run();
}

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (columns.some((item) => item.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function migrateTenantTables() {
  db.exec("PRAGMA foreign_keys = OFF");
  db.exec("DROP TABLE IF EXISTS users_new; DROP TABLE IF EXISTS units_new; DROP TABLE IF EXISTS documents_new;");
  const usersSql = getCreateSql("users");
  if (usersSql && !usersSql.includes("'ventas_admin'")) {
    db.exec(`
      CREATE TABLE users_new (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL DEFAULT 'company-default',
        name TEXT NOT NULL,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('zow_owner', 'admin', 'recepcion_principal', 'recepcion_secundaria', 'funcionario', 'supervisor', 'ventas_admin', 'cajero', 'almacen', 'vendedor')),
        unit_id TEXT NOT NULL,
        position TEXT NOT NULL DEFAULT '',
        ci TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        cash_register_number INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        is_protected INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO users_new (id, company_id, name, username, password_hash, role, unit_id, position, ci, phone, is_active, is_protected, created_at)
      SELECT id, COALESCE(NULLIF(company_id, ''), 'company-default'), name, username, password_hash,
             CASE
               WHEN role = 'ventanilla' THEN 'recepcion_principal'
               WHEN role IN ('zow_owner', 'admin', 'recepcion_principal', 'recepcion_secundaria', 'funcionario', 'supervisor', 'ventas_admin', 'cajero', 'almacen', 'vendedor') THEN role
               ELSE 'funcionario'
             END,
             unit_id, position,
             COALESCE(ci, ''), COALESCE(phone, ''), is_active, is_protected, created_at
      FROM users;
      DROP TABLE users;
      ALTER TABLE users_new RENAME TO users;
    `);
  }

  const unitsSql = getCreateSql("units");
  if (unitsSql && (unitsSql.includes("name TEXT NOT NULL UNIQUE") || unitsSql.includes("code TEXT NOT NULL UNIQUE"))) {
    db.exec(`
      CREATE TABLE units_new (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL DEFAULT 'company-default',
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        parent_unit_id TEXT,
        level TEXT NOT NULL DEFAULT 'secundaria',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (company_id, name),
        UNIQUE (company_id, code)
      );
      INSERT INTO units_new (id, company_id, name, code, parent_unit_id, level, is_active, created_at)
      SELECT id, COALESCE(NULLIF(company_id, ''), 'company-default'), name, code, COALESCE(parent_unit_id, ''), COALESCE(level, 'secundaria'), is_active, created_at
      FROM units;
      DROP TABLE units;
      ALTER TABLE units_new RENAME TO units;
    `);
  }

  const documentsSql = getCreateSql("documents");
  if (documentsSql && documentsSql.includes("code TEXT NOT NULL UNIQUE")) {
    db.exec(`
      CREATE TABLE documents_new (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL DEFAULT 'company-default',
        direction TEXT NOT NULL CHECK (direction IN ('Entrante', 'Saliente')),
        year TEXT NOT NULL,
        type TEXT NOT NULL,
        code TEXT NOT NULL,
        internal_number TEXT NOT NULL DEFAULT '',
        reference TEXT NOT NULL,
        subject TEXT NOT NULL,
        sender TEXT NOT NULL,
        receiver TEXT NOT NULL,
        source_unit_id TEXT,
        target_unit_id TEXT,
        current_unit_id TEXT NOT NULL,
        created_by_unit_id TEXT NOT NULL,
        owner_name TEXT NOT NULL,
        priority TEXT NOT NULL DEFAULT 'Normal',
        status TEXT NOT NULL,
        due_date TEXT NOT NULL,
        has_digital_file INTEGER NOT NULL DEFAULT 0,
        digital_file_name TEXT NOT NULL DEFAULT '',
        digital_file_path TEXT NOT NULL DEFAULT '',
        digital_file_size INTEGER NOT NULL DEFAULT 0,
        digital_attached_at TEXT NOT NULL DEFAULT '',
        physical_received INTEGER NOT NULL DEFAULT 0,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        applicant_name TEXT NOT NULL DEFAULT '',
        applicant_ci TEXT NOT NULL DEFAULT '',
        applicant_phone TEXT NOT NULL DEFAULT '',
        sheet_count INTEGER NOT NULL DEFAULT 0,
        received_at TEXT NOT NULL DEFAULT '',
        UNIQUE (company_id, code)
      );
      INSERT INTO documents_new (
        id, company_id, direction, year, type, code, internal_number, reference, subject, sender, receiver,
        source_unit_id, target_unit_id, current_unit_id, created_by_unit_id, owner_name, priority, status,
        due_date, has_digital_file, digital_file_name, digital_file_path, digital_file_size, digital_attached_at,
        physical_received, created_by, created_at, updated_at, applicant_name, applicant_ci, applicant_phone,
        sheet_count, received_at
      )
      SELECT id, COALESCE(NULLIF(company_id, ''), 'company-default'), direction, year, type, code, internal_number, reference, subject, sender, receiver,
             source_unit_id, target_unit_id, current_unit_id, created_by_unit_id, owner_name, priority, status,
             due_date, has_digital_file, digital_file_name, digital_file_path, digital_file_size, digital_attached_at,
             physical_received, created_by, created_at, updated_at, COALESCE(applicant_name, ''), COALESCE(applicant_ci, ''), COALESCE(applicant_phone, ''),
             COALESCE(sheet_count, 0), COALESCE(received_at, '')
      FROM documents;
      DROP TABLE documents;
      ALTER TABLE documents_new RENAME TO documents;
    `);
  }
  db.exec("PRAGMA foreign_keys = ON");
}

function getCreateSql(table) {
  return db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(table)?.sql || "";
}

function seedBaseConfiguration() {
  db.prepare(
    `INSERT OR IGNORE INTO companies (id, name, slug, plan, status, max_users, max_units, storage_mb, contact_name, contact_email)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "company-default",
    "Empresa Prueba 01",
    "empresa-prueba-01",
    "profesional",
    "active",
    50,
    30,
    10240,
    "Cliente demo",
    "cliente@zow.com"
  );

  const baseUnits = [
    ["unit-admin", "company-default", "Administracion del Sistema", "ADM", "", "principal"],
    ["unit-window", "company-default", "Recepcion Principal", "REC", "", "principal"],
    ["unit-legal", "company-default", "Asesoria Legal", "AL", "", "secundaria"],
    ["unit-finance", "company-default", "Administracion y Finanzas", "AF", "", "secundaria"],
    ["unit-purchases", "company-default", "Compras", "COM", "unit-finance", "subarea"],
    ["unit-tech", "company-default", "Direccion de Tecnologia e Innovacion", "DTI", "", "secundaria"]
  ];

  const insertUnit = db.prepare("INSERT INTO units (id, company_id, name, code, parent_unit_id, level) VALUES (?, ?, ?, ?, ?, ?)");
  baseUnits.forEach((unit) => {
    const existingUnit = db.prepare("SELECT id FROM units WHERE id = ? OR (company_id = ? AND code = ?)").get(unit[0], unit[1], unit[3]);
    if (!existingUnit) insertUnit.run(...unit);
  });
  db.prepare("UPDATE units SET name = ?, code = ? WHERE id = ?").run("Recepcion Principal", "REC", "unit-window");

  db.prepare("INSERT OR IGNORE INTO organization_settings (id, company_id, company_name) VALUES (?, ?, ?)").run(
    "default",
    "company-default",
    "Correspondencia ZOW"
  );
  db.prepare("UPDATE organization_settings SET company_name = ? WHERE id = ? AND company_name = ?").run(
    "Correspondencia ZOW",
    "default",
    "Empresa sin configurar"
  );

  const baseUsers = [
    {
      id: "user-zow-owner",
      companyId: "zow-internal",
      name: "Ramliw ZOW",
      username: "ramliw@zow.com",
      password: seedPassword("ZOW_OWNER_PASSWORD"),
      role: "zow_owner",
      unitId: "unit-zow-admin",
      position: "Duenio del SaaS",
      protected: 1
    },
    {
      id: "user-system-owner",
      companyId: "company-default",
      name: "Encargado de Sistema",
      username: "sistema@zow.com",
      password: seedPassword("SYSTEM_PASSWORD"),
      role: "admin",
      unitId: "unit-admin",
      position: "Encargado de sistema",
      protected: 1
    },
    {
      id: "user-window",
      companyId: "company-default",
      name: "Recepcion Principal ZOW",
      username: "recepcion@zow.com",
      password: seedPassword("SEED_RECEPCION_PASSWORD"),
      role: "recepcion_principal",
      unitId: "unit-window",
      position: "Recepcion documental principal",
      protected: 0
    },
    {
      id: "user-reception-legal",
      companyId: "company-default",
      name: "Recepcion Legal",
      username: "recepcion.legal@zow.com",
      password: seedPassword("SEED_RECEPCION_LEGAL_PASSWORD"),
      role: "recepcion_secundaria",
      unitId: "unit-legal",
      position: "Recepcion interna de area",
      protected: 0
    },
    {
      id: "user-legal",
      companyId: "company-default",
      name: "Responsable Legal",
      username: "legal@zow.com",
      password: seedPassword("SEED_LEGAL_PASSWORD"),
      role: "funcionario",
      unitId: "unit-legal",
      position: "Encargado de area",
      protected: 0
    },
    {
      id: "user-secretary-legal",
      companyId: "company-default",
      name: "Secretario Legal",
      username: "secretario@zow.com",
      password: seedPassword("SEED_SECRETARIO_PASSWORD"),
      role: "supervisor",
      unitId: "unit-legal",
      position: "Jefe de area secundaria",
      protected: 0
    },
    {
      id: "user-finance",
      companyId: "company-default",
      name: "Responsable Finanzas",
      username: "finanzas@zow.com",
      password: seedPassword("SEED_FINANZAS_PASSWORD"),
      role: "funcionario",
      unitId: "unit-finance",
      position: "Encargado de area",
      protected: 0
    },
    {
      id: "user-purchases",
      companyId: "company-default",
      name: "Responsable Compras",
      username: "compras@zow.com",
      password: seedPassword("SEED_COMPRAS_PASSWORD"),
      role: "funcionario",
      unitId: "unit-purchases",
      position: "Encargado de area",
      protected: 0
    },
    {
      id: "user-tech",
      companyId: "company-default",
      name: "Responsable Tecnologia",
      username: "tecnologia@zow.com",
      password: seedPassword("SEED_TECNOLOGIA_PASSWORD"),
      role: "funcionario",
      unitId: "unit-tech",
      position: "Encargado de area",
      protected: 0
    },
    {
      id: "user-director-tech",
      companyId: "company-default",
      name: "Director Tecnologia",
      username: "director@zow.com",
      password: seedPassword("SEED_DIRECTOR_PASSWORD"),
      role: "supervisor",
      unitId: "unit-tech",
      position: "Jefe de sub area",
      protected: 0
    },
    {
      id: "user-ventas-admin",
      companyId: "company-default",
      name: "Administrador Ventas",
      username: "ventas.admin@zow.com",
      password: seedPassword("SEED_VENTAS_ADMIN_PASSWORD"),
      role: "ventas_admin",
      unitId: "unit-finance",
      position: "Administrador de tienda",
      protected: 0
    },
    {
      id: "user-cajero-demo",
      companyId: "company-default",
      name: "Cajero Principal",
      username: "cajero@zow.com",
      password: seedPassword("SEED_CAJERO_PASSWORD"),
      role: "cajero",
      unitId: "unit-finance",
      position: "Caja y ventas",
      protected: 0
    },
    {
      id: "user-almacen-demo",
      companyId: "company-default",
      name: "Responsable Almacen",
      username: "almacen@zow.com",
      password: seedPassword("SEED_ALMACEN_PASSWORD"),
      role: "almacen",
      unitId: "unit-purchases",
      position: "Control de stock",
      protected: 0
    },
    {
      id: "user-vendedor-demo",
      companyId: "company-default",
      name: "Vendedor Mostrador",
      username: "vendedor@zow.com",
      password: seedPassword("SEED_VENDEDOR_PASSWORD"),
      role: "vendedor",
      unitId: "unit-finance",
      position: "Ventas de mostrador",
      protected: 0
    }
  ];

  db.prepare(
    `INSERT OR IGNORE INTO companies (id, name, slug, plan, status, max_users, max_units, storage_mb, contact_name, contact_email)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run("zow-internal", "ZOW Systems", "zow-internal", "interno", "active", 100, 20, 10240, "ZOW", "ramliw@zow.com");
  db.prepare(
    `INSERT OR IGNORE INTO units (id, company_id, name, code, parent_unit_id, level)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run("unit-zow-admin", "zow-internal", "Administracion SaaS ZOW", "ZOW", "", "principal");

  seedSaasSystems();

  const insertUser = db.prepare(
    `INSERT INTO users (id, company_id, name, username, password_hash, role, unit_id, position, is_protected)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  baseUsers.forEach((user) => {
    const existingById = db.prepare("SELECT id FROM users WHERE id = ?").get(user.id);
    if (existingById) {
      db.prepare(
        `UPDATE users
         SET name = ?, username = ?, role = ?, unit_id = ?, position = ?, is_protected = ?
         WHERE id = ?`
      ).run(user.name, user.username, user.role, user.unitId, user.position, user.protected, user.id);
      db.prepare("UPDATE users SET company_id = ? WHERE id = ?").run(user.companyId, user.id);
      return;
    }

    const existingUser = db.prepare("SELECT id FROM users WHERE username = ?").get(user.username);
    if (existingUser) return;
    insertUser.run(
      user.id,
      user.companyId,
      user.name,
      user.username,
      bcrypt.hashSync(user.password, 12),
      user.role,
      user.unitId,
      user.position,
      user.protected
    );
  });
}

function seedSaasSystems() {
  const systems = [
    {
      id: "correspondencia",
      name: "Correspondencia ZOW",
      slug: "correspondencia-zow",
      description: "Recepcion, derivacion, seguimiento y archivo documental."
    },
    {
      id: "ventas_almacen",
      name: "Zow Ventas-Almacen",
      slug: "zow-ventas-almacen",
      description: "Ventas, productos, stock, almacen e inventario."
    }
  ];

  const insertSystem = db.prepare(
    `INSERT INTO saas_systems (id, name, slug, description, status)
     VALUES (?, ?, ?, ?, 'active')
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, slug = excluded.slug, description = excluded.description, status = 'active'`
  );
  systems.forEach((system) => insertSystem.run(system.id, system.name, system.slug, system.description));

  db.prepare(
    `INSERT OR IGNORE INTO company_system_access (company_id, system_id, status, plan)
     VALUES (?, ?, ?, ?)`
  ).run("company-default", "correspondencia", "active", "profesional");
  db.prepare(
    `INSERT OR IGNORE INTO company_system_access (company_id, system_id, status, plan)
     VALUES (?, ?, ?, ?)`
  ).run("company-default", "ventas_almacen", "active", "basico");

  db.prepare(
    `INSERT OR IGNORE INTO company_system_access (company_id, system_id, status, plan)
     SELECT id, 'correspondencia', 'active', plan
     FROM companies
     WHERE id <> 'zow-internal'`
  ).run();
}

function seedPassword(envKey) {
  return process.env[envKey] || `Local-${randomUUID()}#`;
}

module.exports = { db, initDb };
