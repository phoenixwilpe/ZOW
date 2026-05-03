require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const QRCode = require("qrcode");
const { createHash, randomUUID } = require("node:crypto");
const { createClient } = require("@supabase/supabase-js");
const pg = require("./pg");
const { signToken, requireAuth, requireRole, canSeeDocument } = require("./auth-postgres");
const {
  applySecurity,
  corsOptions,
  getLoginStatus,
  recordLoginFailure,
  clearLoginFailures,
  getPublicLookupStatus,
  safePasswordCompare,
  validatePasswordStrength
} = require("./security");

const USER_ROLES = new Set([
  "admin",
  "recepcion_principal",
  "recepcion_secundaria",
  "funcionario",
  "supervisor",
  "ventas_admin",
  "cajero",
  "almacen",
  "vendedor"
]);

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 20 },
  fileFilter: fileFilterForDocuments
});
const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 600 * 1024, files: 1 },
  fileFilter: fileFilterForLogo
});
const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : null;
const storageBucket = process.env.SUPABASE_STORAGE_BUCKET || "documentos";
const showVentasSaas = true;
const enabledPanelSystemIds = ["correspondencia", "ventas_almacen"];

app.use(cors(corsOptions()));
applySecurity(app, express);
app.use(express.static(require("node:path").join(__dirname, "..")));

app.get("/api/health", async (_req, res) => {
  await pg.get("SELECT 1 AS ok");
  res.json({ ok: true, database: "postgres" });
});

app.get("/api/public/qr", async (req, res) => {
  const text = String(req.query.text || "").trim();
  if (!text || text.length > 500) return res.status(400).json({ error: "Texto QR invalido" });
  const buffer = await QRCode.toBuffer(text, { type: "png", width: 220, margin: 1 });
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "no-store");
  res.send(buffer);
});

app.post("/api/leads", async (req, res) => {
  await ensureLeadsSchema();
  const lead = readLeadPayload(req.body);
  if (!lead.name || !lead.company || !lead.phone) return res.status(400).json({ error: "Nombre, empresa y celular son obligatorios" });
  await pg.run(
    `INSERT INTO leads (id, name, company, phone, email, system_id, plan, message, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'nuevo', now(), now())`,
    [lead.id, lead.name, lead.company, lead.phone, lead.email, lead.systemId, lead.plan, lead.message]
  );
  res.status(201).json({ ok: true });
});

app.post("/api/public/documents/lookup", async (req, res) => {
  await ensureCompaniesSchema();
  await ensurePublicLookupAuditSchema();
  await suspendExpiredCompanies();
  const lookupStatus = getPublicLookupStatus(req);
  if (!lookupStatus.allowed) {
    res.setHeader("Retry-After", String(lookupStatus.retryAfterSeconds));
    return res.status(429).json({ error: "Demasiadas consultas. Intenta nuevamente en unos minutos." });
  }
  const code = String(req.body.code || "").trim();
  const ci = String(req.body.ci || "").trim();
  if (!code || !ci || code.length > 40 || ci.length > 40) {
    return res.status(400).json({ error: "Ingresa codigo de control y CI" });
  }

  const companySlug = String(req.body.companySlug || req.query.companySlug || "").trim();
  const documentItem = await pg.get(
    `SELECT documents.id, documents.company_id, documents.code, documents.applicant_name, documents.reference, documents.subject,
            documents.status, documents.received_at, documents.updated_at,
            units.name AS current_unit_name, companies.name AS company_name
     FROM documents
     JOIN companies ON companies.id = documents.company_id
     LEFT JOIN units ON units.id = documents.current_unit_id AND units.company_id = documents.company_id
     WHERE lower(documents.code) = lower(?)
       AND lower(documents.applicant_ci) = lower(?)
       AND companies.status = 'active'
       AND (companies.ends_at = '' OR companies.ends_at >= ?)
       AND (? = '' OR lower(companies.slug) = lower(?))
     LIMIT 1`,
    [code, ci, todayIsoDate(), companySlug, companySlug]
  );
  await recordPublicLookup(req, code, ci, documentItem);
  if (!documentItem) return res.status(404).json({ error: "No se encontro una carpeta con esos datos" });

  res.json({
    document: {
      code: documentItem.code,
      applicantName: documentItem.applicant_name,
      reference: documentItem.reference,
      subject: documentItem.subject,
      status: documentItem.status,
      receivedAt: documentItem.received_at,
      updatedAt: documentItem.updated_at,
      currentArea: documentItem.current_unit_name || "En proceso",
      companyName: documentItem.company_name
    }
  });
});

app.post("/api/auth/login", async (req, res) => {
  await ensureCompaniesSchema();
  await suspendExpiredCompanies();
  const normalizedUsername = normalizeUsername(req.body.username);
  const loginStatus = getLoginStatus(req, normalizedUsername);
  if (!loginStatus.allowed) {
    res.setHeader("Retry-After", String(loginStatus.retryAfterSeconds));
    return res.status(429).json({ error: "Demasiados intentos fallidos. Intenta nuevamente en unos minutos." });
  }
  const user =
    (await pg.get("SELECT * FROM users WHERE lower(username) = lower(?) AND is_active = true", [normalizedUsername])) ||
    (!normalizedUsername.includes("@")
      ? await pg.get("SELECT * FROM users WHERE lower(username) = lower(?) AND is_active = true", [`${normalizedUsername}@zow.com`])
      : null);

  if (!safePasswordCompare(req.body.password, user?.password_hash)) {
    recordLoginFailure(loginStatus.key);
    await ensureAuditSchema();
    await recordAuditEvent({
      req,
      action: "login_failed",
      entityType: "user",
      entityId: "",
      description: `Intento fallido para ${normalizedUsername}`,
      metadata: { username: normalizedUsername }
    });
    return res.status(401).json({ error: "Usuario o contrasena incorrectos" });
  }
  const company = await pg.get("SELECT status, billing_period, starts_at, ends_at FROM companies WHERE id = ?", [user.company_id]);
  if (!company || company.status !== "active") return res.status(403).json({ error: "La empresa no esta activa o la membresia vencio. Contacte a ZOW." });
  clearLoginFailures(loginStatus.key);

  const publicData = await pg.get(
    `SELECT users.id, users.company_id, users.name, users.username, users.role, users.unit_id, users.position, users.ci, users.phone,
            units.name AS unit_name, companies.name AS company_name, companies.slug AS company_slug, companies.plan, companies.billing_period, companies.starts_at, companies.ends_at, companies.status AS company_status
     FROM users
     JOIN units ON units.id = users.unit_id
     JOIN companies ON companies.id = users.company_id
     WHERE users.id = ?`,
    [user.id]
  );
  req.user = publicData;
  await ensureAuditSchema();
  await recordAuditEvent({ req, action: "login_success", entityType: "user", entityId: user.id, description: "Inicio de sesion correcto" });
  res.json({ token: signToken(user), user: publicUser(publicData) });
});

app.get("/api/auth/me", requireAuth, (req, res) => res.json({ user: req.user }));

app.get("/api/auth/systems", requireAuth, async (req, res) => {
  if (req.user.role === "zow_owner") {
    const systems = await pg.all("SELECT * FROM saas_systems WHERE status = 'active' AND id = ANY(?::text[]) ORDER BY name", [enabledPanelSystemIds]);
    return res.json({ systems });
  }
  const systems = await pg.all(
    `SELECT saas_systems.*, company_system_access.plan, company_system_access.status AS access_status
     FROM company_system_access
     JOIN saas_systems ON saas_systems.id = company_system_access.system_id
     WHERE company_system_access.company_id = ? AND company_system_access.status = 'active' AND saas_systems.status = 'active' AND saas_systems.id = ANY(?::text[])
     ORDER BY saas_systems.name`,
    [req.user.company_id, enabledPanelSystemIds]
  );
  res.json({ systems });
});

app.get("/api/units", requireAuth, async (req, res) => {
  if (req.user.role === "zow_owner") return res.json({ units: [] });
  const units = await pg.all("SELECT id, company_id, name, code, parent_unit_id, level, is_active FROM units WHERE company_id = ? ORDER BY name", [
    req.user.company_id
  ]);
  res.json({ units });
});

app.get("/api/settings", requireAuth, async (req, res) => {
  if (req.user.role === "zow_owner") return res.json({ settings: { companyName: "Panel ZOW SaaS" } });
  await ensureSettingsSchema();
  res.json({ settings: await mapSettings(await loadSettings(req.user.company_id)) });
});

app.patch("/api/settings", requireAuth, requireRole("admin"), async (req, res) => {
  await ensureSettingsSchema();
  const companyName = String(req.body.companyName || "").trim();
  if (!companyName) return res.status(400).json({ error: "Nombre de empresa obligatorio" });
  const settings = {
    companyName,
    taxId: String(req.body.taxId || "").trim(),
    phone: String(req.body.phone || "").trim(),
    address: String(req.body.address || "").trim()
  };
  await pg.run(
    `INSERT INTO organization_settings (id, company_id, company_name, tax_id, phone, address, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, now())
     ON CONFLICT(id) DO UPDATE SET company_name = excluded.company_name, tax_id = excluded.tax_id, phone = excluded.phone, address = excluded.address, updated_at = excluded.updated_at`,
    [req.user.company_id, req.user.company_id, settings.companyName, settings.taxId, settings.phone, settings.address]
  );
  await recordAuditEvent({ req, action: "settings_update", entityType: "settings", entityId: req.user.company_id, description: "Actualizo datos de empresa y membrete" });
  res.json({ settings: await mapSettings(await loadSettings(req.user.company_id)) });
});

app.post("/api/settings/logo", requireAuth, requireRole("admin"), logoUpload.single("logo"), async (req, res) => {
  await ensureSettingsSchema();
  if (!req.file) return res.status(400).json({ error: "Selecciona un logo PNG" });
  if (!supabase) return res.status(500).json({ error: "Storage no configurado" });
  const now = new Date().toISOString();
  const storagePath = `${req.user.company_id}/branding/${randomUUID()}-${sanitizeFileName(req.file.originalname || "logo.png")}`;
  const { error } = await supabase.storage.from(storageBucket).upload(storagePath, req.file.buffer, {
    contentType: req.file.mimetype || "image/png",
    upsert: false
  });
  if (error) return res.status(500).json({ error: "No se pudo subir el logo" });
  await pg.run(
    `INSERT INTO organization_settings (id, company_id, company_name, logo_bucket, logo_path, logo_name, logo_mime, logo_updated_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?::timestamptz, now())
     ON CONFLICT(id) DO UPDATE SET logo_bucket = excluded.logo_bucket, logo_path = excluded.logo_path, logo_name = excluded.logo_name, logo_mime = excluded.logo_mime, logo_updated_at = excluded.logo_updated_at, updated_at = excluded.updated_at`,
    [
      req.user.company_id,
      req.user.company_id,
      req.user.company_name || "Empresa sin configurar",
      storageBucket,
      storagePath,
      req.file.originalname || "logo.png",
      req.file.mimetype || "image/png",
      now
    ]
  );
  await recordAuditEvent({ req, action: "logo_update", entityType: "settings", entityId: req.user.company_id, description: "Actualizo logo institucional" });
  res.json({ settings: await mapSettings(await loadSettings(req.user.company_id)) });
});

app.post("/api/units", requireAuth, requireRole("admin"), async (req, res) => {
  const unit = {
    id: randomUUID(),
    name: String(req.body.name || "").trim(),
    code: String(req.body.code || "").trim().toUpperCase(),
    parentUnitId: String(req.body.parentUnitId || ""),
    level: String(req.body.level || "secundaria")
  };
  if (!unit.name || !unit.code) return res.status(400).json({ error: "Nombre y codigo son obligatorios" });
  const parent = unit.parentUnitId ? await pg.get("SELECT id FROM units WHERE id = ? AND company_id = ?", [unit.parentUnitId, req.user.company_id]) : null;
  if (unit.parentUnitId && !parent) return res.status(400).json({ error: "El area padre no pertenece a esta empresa" });
  await pg.run("INSERT INTO units (id, company_id, name, code, parent_unit_id, level) VALUES (?, ?, ?, ?, ?, ?)", [
    unit.id,
    req.user.company_id,
    unit.name,
    unit.code,
    unit.parentUnitId,
    unit.level
  ]);
  await recordAuditEvent({ req, action: "unit_create", entityType: "unit", entityId: unit.id, description: `Creo area ${unit.name}` });
  res.status(201).json({ unit });
});

app.get("/api/users", requireAuth, requireRole("admin"), async (req, res) => {
  const users = await pg.all(
    `SELECT users.id, users.name, users.username, users.role, users.unit_id, users.position, users.ci, users.phone,
            users.is_active, users.is_protected, units.name AS unit_name
     FROM users
     JOIN units ON units.id = users.unit_id
     WHERE users.company_id = ?
     ORDER BY users.name`,
    [req.user.company_id]
  );
  res.json({ users });
});

app.post("/api/users", requireAuth, requireRole("admin"), async (req, res) => {
  const password = String(req.body.password || "").trim();
  const user = readUserPayload(req.body);
  user.id = randomUUID();
  if (!user.name || !user.username || !password || !user.unitId) return res.status(400).json({ error: "Faltan datos obligatorios" });
  if (!USER_ROLES.has(user.role)) return res.status(400).json({ error: "Rol invalido" });
  if (user.role === "admin") return res.status(403).json({ error: "Solo ZOW puede crear el encargado de sistema inicial" });
  const passwordError = validatePasswordStrength(password);
  if (passwordError) return res.status(400).json({ error: passwordError });
  const duplicate = await pg.get("SELECT id FROM users WHERE lower(username) = lower(?)", [user.username]);
  if (duplicate) return res.status(400).json({ error: "Ese usuario ya existe" });
  const unit = await pg.get("SELECT id FROM units WHERE id = ? AND company_id = ?", [user.unitId, req.user.company_id]);
  if (!unit) return res.status(400).json({ error: "La unidad no pertenece a esta empresa" });
  await pg.run(
    `INSERT INTO users (id, company_id, name, username, password_hash, role, unit_id, position, ci, phone)
     VALUES (?, ?, ?, ?, ?, ?::user_role, ?, ?, ?, ?)`,
    [user.id, req.user.company_id, user.name, user.username, bcrypt.hashSync(password, 12), user.role, user.unitId, user.position, user.ci, user.phone]
  );
  await recordAuditEvent({ req, action: "user_create", entityType: "user", entityId: user.id, description: `Creo usuario ${user.username}`, metadata: { role: user.role } });
  res.status(201).json({ user });
});

app.patch("/api/users/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const existing = await pg.get("SELECT id, username, role, unit_id, is_protected FROM users WHERE id = ? AND company_id = ?", [req.params.id, req.user.company_id]);
  if (!existing) return res.status(404).json({ error: "Usuario no encontrado" });
  const user = readUserPayload(req.body);
  user.password = String(req.body.password || "").trim();
  if (!user.name || !user.username || !user.unitId) return res.status(400).json({ error: "Nombre, usuario y unidad son obligatorios" });
  if (!USER_ROLES.has(user.role)) return res.status(400).json({ error: "Rol invalido" });
  if (!existing.is_protected && user.role === "admin") {
    return res.status(403).json({ error: "No se puede asignar el rol Encargado de sistema desde usuarios" });
  }
  const duplicate = await pg.get("SELECT id FROM users WHERE lower(username) = lower(?) AND id <> ?", [user.username, existing.id]);
  if (duplicate) return res.status(400).json({ error: "Ese usuario ya existe" });
  const unit = await pg.get("SELECT id FROM units WHERE id = ? AND company_id = ?", [user.unitId, req.user.company_id]);
  if (!existing.is_protected && !unit) return res.status(400).json({ error: "La unidad no pertenece a esta empresa" });
  const finalRole = existing.is_protected ? existing.role : user.role;
  const finalUnit = existing.is_protected ? existing.unit_id : user.unitId;
  await pg.run(
    `UPDATE users SET name = ?, username = ?, role = ?::user_role, unit_id = ?, position = ?, ci = ?, phone = ? WHERE id = ?`,
    [user.name, user.username, finalRole, finalUnit, user.position, user.ci, user.phone, existing.id]
  );
  if (user.password) {
    const passwordError = validatePasswordStrength(user.password);
    if (passwordError) return res.status(400).json({ error: passwordError });
    await pg.run("UPDATE users SET password_hash = ? WHERE id = ?", [bcrypt.hashSync(user.password, 12), existing.id]);
  }
  await recordAuditEvent({
    req,
    action: "user_update",
    entityType: "user",
    entityId: existing.id,
    description: `Actualizo usuario ${user.username}`,
    metadata: { role: finalRole, passwordChanged: Boolean(user.password) }
  });
  res.json({ user: await pg.get("SELECT id, company_id, name, username, role, unit_id, position, ci, phone, is_active, is_protected FROM users WHERE id = ?", [existing.id]) });
});

app.patch("/api/users/:id/status", requireAuth, requireRole("admin"), async (req, res) => {
  const user = await pg.get("SELECT id, username, is_protected FROM users WHERE id = ? AND company_id = ?", [req.params.id, req.user.company_id]);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
  if (user.is_protected) return res.status(400).json({ error: "No se puede desactivar un usuario protegido" });
  await pg.run("UPDATE users SET is_active = ? WHERE id = ?", [Boolean(req.body.active), user.id]);
  await recordAuditEvent({
    req,
    action: "user_status",
    entityType: "user",
    entityId: user.id,
    description: `${Boolean(req.body.active) ? "Activo" : "Desactivo"} usuario ${user.username}`
  });
  res.json({ ok: true });
});

app.get("/api/documents", requireAuth, async (req, res) => {
  if (req.user.role === "zow_owner") return res.json({ documents: [] });
  const rows = await pg.all(
    `SELECT documents.*,
            COALESCE((SELECT COUNT(*)::int FROM document_files WHERE document_files.company_id = documents.company_id AND document_files.document_id = documents.id), 0) AS digital_file_count,
            COALESCE((SELECT STRING_AGG(original_name, ', ') FROM document_files WHERE document_files.company_id = documents.company_id AND document_files.document_id = documents.id), documents.digital_file_name) AS digital_file_names
     FROM documents
     WHERE documents.company_id = ?
     ORDER BY documents.created_at DESC`,
    [req.user.company_id]
  );
  const documents = [];
  for (const doc of rows) if (await canSeeDocument(req.user, doc)) documents.push(doc);
  res.json({ documents });
});

app.get("/api/notifications", requireAuth, async (req, res) => {
  if (["admin", "recepcion_principal"].includes(req.user.role)) return res.json({ notifications: [], pendingCount: 0 });
  const notifications = await pg.all(
    `SELECT documents.id, documents.code, documents.subject, documents.reference, documents.applicant_name,
            documents.status, document_recipients.received_at
     FROM document_recipients
     JOIN documents ON documents.id = document_recipients.document_id
     WHERE document_recipients.company_id = ? AND documents.company_id = ? AND document_recipients.unit_id = ? AND document_recipients.status = 'Pendiente'
     ORDER BY document_recipients.received_at DESC`,
    [req.user.company_id, req.user.company_id, req.user.unit_id]
  );
  res.json({ notifications, pendingCount: notifications.length });
});

const documentUpload = upload.fields([
  { name: "digitalFile", maxCount: 1 },
  { name: "digitalFiles", maxCount: 20 }
]);

app.post("/api/documents", requireAuth, requireRole("recepcion_principal", "funcionario"), documentUpload, async (req, res) => {
  const id = randomUUID();
  const now = new Date().toISOString();
  const direction = req.body.direction === "Saliente" ? "Saliente" : "Entrante";
  if (direction === "Entrante" && !["admin", "recepcion_principal"].includes(req.user.role)) {
    return res.status(403).json({ error: "Solo Recepcion puede registrar documentacion entrante" });
  }
  const reception = await pg.get(
    "SELECT id FROM units WHERE company_id = ? AND level = 'principal' AND code IN ('VU', 'REC') ORDER BY code DESC LIMIT 1",
    [req.user.company_id]
  );
  const currentUnitId = direction === "Entrante" ? reception?.id || req.user.unit_id : req.user.unit_id;
  const files = getUploadedFiles(req);
  const primaryFile = files[0];
  const doc = {
    id,
    direction,
    year: String(req.body.year || new Date().getFullYear()),
    type: String(req.body.type || "Oficio"),
    code: await buildNextDocumentCode(req.user.company_id, String(req.body.year || new Date().getFullYear()), now),
    internalNumber: String(req.body.internalNumber || ""),
    reference: String(req.body.reference || ""),
    subject: String(req.body.subject || req.body.reference || ""),
    applicantName: String(req.body.applicantName || req.body.sender || "").trim(),
    applicantCi: String(req.body.applicantCi || "").trim(),
    applicantPhone: String(req.body.applicantPhone || "").trim(),
    sheetCount: Number(req.body.sheetCount || 0),
    sender: String(req.body.sender || req.body.applicantName || req.user.unit_name),
    receiver: String(req.body.receiver || ""),
    targetUnitId: String(req.body.targetUnitId || ""),
    currentUnitId,
    ownerName: direction === "Entrante" ? "Recepcion Principal" : req.user.name,
    priority: String(req.body.priority || "Normal"),
    status: direction === "Entrante" ? "En recepcion" : "Recibido",
    dueDate: String(req.body.dueDate || now.slice(0, 10))
  };

  await pg.tx(async (client) => {
    await client.run(
      `INSERT INTO documents (
        id, direction, year, type, code, internal_number, reference, subject, sender, receiver,
        company_id, source_unit_id, target_unit_id, current_unit_id, created_by_unit_id, owner_name, priority,
        status, due_date, has_digital_file, digital_file_name, digital_file_path, digital_file_size,
        digital_attached_at, physical_received, created_by, created_at, updated_at,
        applicant_name, applicant_ci, applicant_phone, sheet_count, received_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::timestamptz, ?::timestamptz, ?, ?, ?, ?, ?)`,
      [
        doc.id,
        doc.direction,
        doc.year,
        doc.type,
        doc.code,
        doc.internalNumber,
        doc.reference,
        doc.subject,
        doc.sender,
        doc.receiver,
        req.user.company_id,
        direction === "Entrante" ? "external" : req.user.unit_id,
        doc.targetUnitId,
        doc.currentUnitId,
        req.user.unit_id,
        doc.ownerName,
        doc.priority,
        doc.status,
        doc.dueDate,
        files.length > 0,
        primaryFile?.originalname || "",
        "",
        primaryFile?.size || 0,
        files.length ? now : "",
        direction === "Entrante",
        req.user.id,
        now,
        now,
        doc.applicantName,
        doc.applicantCi,
        doc.applicantPhone,
        doc.sheetCount,
        now
      ]
    );
    await client.run(
      `INSERT INTO movements (id, company_id, document_id, from_unit_id, to_unit_id, instruction_type, due_days, comment, status, created_by, derived_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        req.user.company_id,
        doc.id,
        null,
        doc.currentUnitId,
        "Registro inicial",
        0,
        `Documento registrado. Adjuntos digitales: ${files.length || 0}.`,
        doc.status,
        req.user.id,
        now
      ]
    );
    await client.run(
      `INSERT INTO document_recipients (company_id, document_id, unit_id, status, received_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(document_id, unit_id) DO NOTHING`,
      [req.user.company_id, doc.id, doc.currentUnitId, doc.status, now]
    );
  });

  await attachUploadedFiles({ files, companyId: req.user.company_id, documentId: doc.id, userId: req.user.id, uploadedAt: now });
  await recordAuditEvent({ req, action: "document_create", entityType: "document", entityId: doc.id, description: `Registro ${doc.code}`, metadata: { direction: doc.direction } });
  res.status(201).json({ document: await getDocumentById(id, req.user.company_id) });
});

app.patch("/api/documents/:id/status", requireAuth, async (req, res) => {
  const doc = await pg.get("SELECT * FROM documents WHERE id = ? AND company_id = ?", [req.params.id, req.user.company_id]);
  if (!doc) return res.status(404).json({ error: "Documento no encontrado" });
  if (!(await canSeeDocument(req.user, doc))) return res.status(403).json({ error: "Permiso insuficiente" });
  const status = String(req.body.status || "");
  if (!["En revision", "Atendido", "Archivado", "Recibido", "Vencido"].includes(status)) return res.status(400).json({ error: "Estado invalido" });
  if (req.user.role === "recepcion_principal" && ["Atendido", "Archivado"].includes(status)) {
    return res.status(403).json({ error: "Recepcion principal no puede atender o archivar documentacion de areas" });
  }
  const now = new Date().toISOString();
  await pg.run("UPDATE documents SET status = ?, updated_at = ? WHERE id = ?", [status, now, doc.id]);
  await pg.run("UPDATE document_recipients SET status = ? WHERE document_id = ? AND unit_id = ?", [status, doc.id, req.user.unit_id]);
  await pg.run(
    `INSERT INTO movements (id, company_id, document_id, from_unit_id, to_unit_id, instruction_type, due_days, comment, status, created_by, derived_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [randomUUID(), req.user.company_id, doc.id, doc.current_unit_id, doc.current_unit_id, "Cambio de estado", 0, String(req.body.comment || `Estado actualizado a ${status}.`), status, req.user.id, now]
  );
  await recordAuditEvent({ req, action: "document_status", entityType: "document", entityId: doc.id, description: `Cambio estado a ${status}` });
  res.json({ document: await getDocumentById(doc.id, req.user.company_id) });
});

app.patch("/api/documents/:id/physical-received", requireAuth, async (req, res) => {
  const doc = await pg.get("SELECT * FROM documents WHERE id = ? AND company_id = ?", [req.params.id, req.user.company_id]);
  if (!doc) return res.status(404).json({ error: "Documento no encontrado" });
  if (!(await canSeeDocument(req.user, doc))) return res.status(403).json({ error: "Permiso insuficiente" });
  const now = new Date().toISOString();
  const status = doc.status === "Reservado" ? "Recibido" : doc.status;
  await pg.run("UPDATE documents SET physical_received = true, status = ?, updated_at = ? WHERE id = ?", [status, now, doc.id]);
  await recordAuditEvent({ req, action: "physical_received", entityType: "document", entityId: doc.id, description: "Marco recepcion fisica" });
  res.json({ document: await getDocumentById(doc.id, req.user.company_id) });
});

app.post("/api/documents/:id/derive", requireAuth, requireRole("recepcion_principal", "recepcion_secundaria", "funcionario", "supervisor"), async (req, res) => {
  const doc = await pg.get("SELECT * FROM documents WHERE id = ? AND company_id = ?", [req.params.id, req.user.company_id]);
  if (!doc) return res.status(404).json({ error: "Documento no encontrado" });
  if (!(await canSeeDocument(req.user, doc))) return res.status(403).json({ error: "Permiso insuficiente" });
  const unitIds = Array.isArray(req.body.toUnitIds) ? req.body.toUnitIds : [req.body.toUnitId];
  const uniqueUnitIds = [...new Set(unitIds.map((id) => String(id || "").trim()).filter(Boolean))];
  if (!uniqueUnitIds.length) return res.status(400).json({ error: "Selecciona al menos un area destino" });
  const units = [];
  for (const unitId of uniqueUnitIds) {
    const unit = await pg.get("SELECT id, name FROM units WHERE id = ? AND company_id = ?", [unitId, req.user.company_id]);
    if (unit) units.push(unit);
  }
  if (units.length !== uniqueUnitIds.length) return res.status(400).json({ error: "Uno o mas destinos no pertenecen a esta empresa" });
  const now = new Date().toISOString();
  await pg.tx(async (client) => {
    for (const unit of units) {
      await client.run(
        `INSERT INTO movements (id, company_id, document_id, from_unit_id, to_unit_id, instruction_type, due_days, comment, status, created_by, derived_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [randomUUID(), req.user.company_id, doc.id, req.user.unit_id, unit.id, String(req.body.instructionType || "Derivacion"), Number(req.body.dueDays || 0), buildDerivationComment(unit.name, req.body.comment), "Derivado", req.user.id, now]
      );
      await client.run(
        `INSERT INTO document_recipients (company_id, document_id, unit_id, status, received_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(document_id, unit_id) DO UPDATE SET status = excluded.status, received_at = excluded.received_at`,
        [req.user.company_id, doc.id, unit.id, "Pendiente", now]
      );
    }
    await client.run(
      "UPDATE documents SET target_unit_id = ?, current_unit_id = ?, receiver = ?, status = ?, updated_at = ? WHERE id = ?",
      [units[0].id, units[0].id, units.length === 1 ? units[0].name : `${units.length} unidades derivadas`, "Derivado", now, doc.id]
    );
  });
  await recordAuditEvent({ req, action: "document_derive", entityType: "document", entityId: doc.id, description: `Derivo a ${units.length} unidad(es)`, metadata: { units: units.map((unit) => unit.name) } });
  res.json({ document: await getDocumentById(doc.id, req.user.company_id) });
});

app.get("/api/documents/:id/files", requireAuth, async (req, res) => {
  const doc = await pg.get("SELECT * FROM documents WHERE id = ? AND company_id = ?", [req.params.id, req.user.company_id]);
  if (!doc) return res.status(404).json({ error: "Documento no encontrado" });
  if (!(await canSeeDocument(req.user, doc))) return res.status(403).json({ error: "Permiso insuficiente" });
  const files = await pg.all("SELECT id, original_name, size, mime_type, uploaded_at FROM document_files WHERE company_id = ? AND document_id = ? ORDER BY uploaded_at DESC", [
    req.user.company_id,
    doc.id
  ]);
  res.json({ files });
});

app.post("/api/documents/:id/digital-file", requireAuth, documentUpload, async (req, res) => {
  const doc = await pg.get("SELECT * FROM documents WHERE id = ? AND company_id = ?", [req.params.id, req.user.company_id]);
  if (!doc) return res.status(404).json({ error: "Documento no encontrado" });
  if (!(await canSeeDocument(req.user, doc))) return res.status(403).json({ error: "Permiso insuficiente" });
  const files = getUploadedFiles(req);
  if (!files.length) return res.status(400).json({ error: "Adjunta al menos un archivo" });
  const now = new Date().toISOString();
  await attachUploadedFiles({ files, companyId: req.user.company_id, documentId: doc.id, userId: req.user.id, uploadedAt: now });
  const primaryFile = files[0];
  await pg.run(
    "UPDATE documents SET has_digital_file = true, digital_file_name = ?, digital_file_size = ?, digital_attached_at = ?, updated_at = ? WHERE id = ?",
    [primaryFile.originalname, primaryFile.size || 0, now, now, doc.id]
  );
  await recordAuditEvent({ req, action: "document_upload", entityType: "document", entityId: doc.id, description: `Adjunto ${files.length} archivo(s)` });
  res.json({ document: await getDocumentById(doc.id, req.user.company_id) });
});

app.get("/api/documents/:id/digital-file", requireAuth, async (req, res) => {
  const doc = await pg.get("SELECT * FROM documents WHERE id = ? AND company_id = ?", [req.params.id, req.user.company_id]);
  if (!doc) return res.status(404).json({ error: "Documento no encontrado" });
  if (!(await canSeeDocument(req.user, doc))) return res.status(403).json({ error: "Permiso insuficiente" });
  const file = await pg.get("SELECT * FROM document_files WHERE company_id = ? AND document_id = ? ORDER BY uploaded_at DESC LIMIT 1", [req.user.company_id, doc.id]);
  if (!file?.storage_path || !supabase) return res.status(404).json({ error: "Archivo no disponible" });
  const { data, error } = await supabase.storage.from(file.storage_bucket || storageBucket).createSignedUrl(file.storage_path, 60);
  if (error) return res.status(500).json({ error: "No se pudo generar enlace del archivo" });
  res.redirect(data.signedUrl);
});

app.get("/api/documents/:id/movements", requireAuth, async (req, res) => {
  const doc = await pg.get("SELECT * FROM documents WHERE id = ? AND company_id = ?", [req.params.id, req.user.company_id]);
  if (!doc) return res.status(404).json({ error: "Documento no encontrado" });
  if (!(await canSeeDocument(req.user, doc))) return res.status(403).json({ error: "Permiso insuficiente" });
  const movements = await pg.all(
    `SELECT movements.*, from_units.name AS from_unit_name, to_units.name AS to_unit_name, users.name AS created_by_name
     FROM movements
     LEFT JOIN units AS from_units ON from_units.id = movements.from_unit_id
     LEFT JOIN units AS to_units ON to_units.id = movements.to_unit_id
     LEFT JOIN users ON users.id = movements.created_by
     WHERE movements.company_id = ? AND movements.document_id = ?
     ORDER BY movements.derived_at DESC`,
    [req.user.company_id, doc.id]
  );
  res.json({ movements });
});

app.patch("/api/documents/:id/seen", requireAuth, async (req, res) => {
  await pg.run("UPDATE document_recipients SET status = 'En revision' WHERE company_id = ? AND document_id = ? AND unit_id = ? AND status = 'Pendiente'", [
    req.user.company_id,
    req.params.id,
    req.user.unit_id
  ]);
  res.json({ ok: true });
});

app.get("/api/companies", requireAuth, requireRole("zow_owner"), async (_req, res) => {
  await ensureCompaniesSchema();
  await suspendExpiredCompanies();
  const companies = await pg.all(
    `SELECT companies.*,
            COALESCE((SELECT COUNT(*)::int FROM users WHERE users.company_id = companies.id), 0) AS user_count,
            COALESCE((SELECT COUNT(*)::int FROM units WHERE units.company_id = companies.id), 0) AS unit_count,
            COALESCE((SELECT COUNT(*)::int FROM documents WHERE documents.company_id = companies.id), 0) AS document_count,
            COALESCE((SELECT STRING_AGG(saas_systems.name, ', ' ORDER BY saas_systems.name)
              FROM company_system_access
              JOIN saas_systems ON saas_systems.id = company_system_access.system_id
              WHERE company_system_access.company_id = companies.id AND company_system_access.status = 'active' AND saas_systems.id = ANY(?::text[])), '') AS systems,
            admin_user.id AS admin_user_id,
            admin_user.name AS admin_name,
            admin_user.username AS admin_username
     FROM companies
     LEFT JOIN LATERAL (
       SELECT id, name, username
       FROM users
       WHERE users.company_id = companies.id AND users.role = 'admin'
       ORDER BY is_protected DESC, created_at ASC
       LIMIT 1
     ) AS admin_user ON true
     WHERE companies.id NOT IN ('zow-internal', 'company-default')
       AND companies.slug NOT LIKE 'cliente-prueba-%'
       AND (?::boolean = true OR NOT EXISTS (
         SELECT 1
         FROM company_system_access hidden_access
         WHERE hidden_access.company_id = companies.id
           AND hidden_access.system_id = 'ventas_almacen'
           AND hidden_access.status = 'active'
       ))
     ORDER BY created_at DESC`
    ,
    [enabledPanelSystemIds, showVentasSaas]
  );
  res.json({ companies });
});

app.get("/api/public-lookups", requireAuth, requireRole("zow_owner"), async (_req, res) => {
  await ensurePublicLookupAuditSchema();
  const lookups = await pg.all(
    `SELECT public_lookup_audit.id, public_lookup_audit.code, public_lookup_audit.ip_address,
            public_lookup_audit.user_agent, public_lookup_audit.found, public_lookup_audit.created_at,
            companies.name AS company_name, documents.applicant_name
     FROM public_lookup_audit
     LEFT JOIN companies ON companies.id = public_lookup_audit.company_id
     LEFT JOIN documents ON documents.id = public_lookup_audit.document_id
     ORDER BY public_lookup_audit.created_at DESC
     LIMIT 80`
  );
  res.json({ lookups });
});

app.get("/api/system-health", requireAuth, requireRole("zow_owner"), async (_req, res) => {
  await ensureAuditSchema();
  await ensurePublicLookupAuditSchema();
  const [companies, users, documents, audit, publicLookups, dbTime] = await Promise.all([
    pg.get("SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'active')::int AS active, COUNT(*) FILTER (WHERE status = 'suspended')::int AS suspended FROM companies WHERE id <> 'zow-internal'"),
    pg.get("SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_active = true)::int AS active FROM users"),
    pg.get("SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'Archivado')::int AS archived FROM documents"),
    pg.get("SELECT COUNT(*)::int AS total, MAX(created_at) AS latest FROM audit_events"),
    pg.get("SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE found = false)::int AS failed FROM public_lookup_audit"),
    pg.get("SELECT now() AS now")
  ]);
  res.json({
    ok: true,
    database: "postgres",
    checkedAt: new Date().toISOString(),
    dbTime: dbTime?.now,
    companies,
    users,
    documents,
    audit,
    publicLookups
  });
});

app.get("/api/leads", requireAuth, requireRole("zow_owner"), async (_req, res) => {
  await ensureLeadsSchema();
  const leads = await pg.all("SELECT * FROM leads ORDER BY created_at DESC LIMIT 200");
  const histories = leads.length
    ? await pg.all(
        `SELECT *
         FROM lead_history
         WHERE lead_id = ANY(?)
         ORDER BY created_at DESC`,
        [leads.map((lead) => lead.id)]
      )
    : [];
  const historyByLead = histories.reduce((map, item) => {
    map[item.lead_id] ||= [];
    map[item.lead_id].push(item);
    return map;
  }, {});
  leads.forEach((lead) => {
    lead.history = historyByLead[lead.id] || [];
  });
  res.json({ leads });
});

app.patch("/api/leads/:id/status", requireAuth, requireRole("zow_owner"), async (req, res) => {
  await ensureLeadsSchema();
  const status = String(req.body.status || "").trim();
  if (!["nuevo", "contactado", "demo_agendada", "propuesta_enviada", "convertido", "descartado"].includes(status)) return res.status(400).json({ error: "Estado invalido" });
  const lead = await pg.get("SELECT id, company FROM leads WHERE id = ?", [req.params.id]);
  if (!lead) return res.status(404).json({ error: "Lead no encontrado" });
  await pg.run("UPDATE leads SET status = ?, updated_at = now() WHERE id = ?", [status, lead.id]);
  await recordLeadHistory({ req, leadId: lead.id, status, description: `Cambio de estado a ${status}` });
  await recordAuditEvent({ req, action: "lead_status", entityType: "lead", entityId: lead.id, description: `Cambio lead ${lead.company} a ${status}` });
  res.json({ ok: true });
});

app.patch("/api/leads/:id", requireAuth, requireRole("zow_owner"), async (req, res) => {
  await ensureLeadsSchema();
  const status = String(req.body.status || "").trim();
  if (status && !["nuevo", "contactado", "demo_agendada", "propuesta_enviada", "convertido", "descartado"].includes(status)) return res.status(400).json({ error: "Estado invalido" });
  const lead = await pg.get("SELECT id, company FROM leads WHERE id = ?", [req.params.id]);
  if (!lead) return res.status(404).json({ error: "Lead no encontrado" });
  const notes = String(req.body.notes || "").trim().slice(0, 1200);
  const nextAction = String(req.body.nextAction || req.body.next_action || "").trim().slice(0, 220);
  const nextActionAt = normalizeDateInput(req.body.nextActionAt || req.body.next_action_at);
  const priority = normalizeLeadPriority(req.body.priority || "media");
  const current = await pg.get("SELECT status, notes, next_action, next_action_at, priority FROM leads WHERE id = ?", [lead.id]);
  await pg.run(
    `UPDATE leads
     SET status = COALESCE(NULLIF(?, ''), status),
         priority = ?,
         notes = ?,
         next_action = ?,
         next_action_at = ?,
         updated_at = now()
     WHERE id = ?`,
    [status, priority, notes, nextAction, nextActionAt, lead.id]
  );
  await recordLeadHistory({
    req,
    leadId: lead.id,
    status: status || current.status,
    priority,
    nextAction,
    nextActionAt,
    notes,
    description: buildLeadHistoryDescription(current, { status, priority, notes, nextAction, nextActionAt })
  });
  await recordAuditEvent({ req, action: "lead_update", entityType: "lead", entityId: lead.id, description: `Actualizo seguimiento de lead ${lead.company}` });
  const updatedLead = await pg.get("SELECT * FROM leads WHERE id = ?", [lead.id]);
  updatedLead.history = await pg.all("SELECT * FROM lead_history WHERE lead_id = ? ORDER BY created_at DESC", [lead.id]);
  res.json({ lead: updatedLead });
});

app.get("/api/audit", requireAuth, requireRole("admin", "zow_owner"), async (req, res) => {
  await ensureAuditSchema();
  const params = [];
  const companyFilter = req.user.role === "zow_owner" ? "" : "WHERE audit_events.company_id = ?";
  if (companyFilter) params.push(req.user.company_id);
  const events = await pg.all(
    `SELECT audit_events.*, companies.name AS company_name
     FROM audit_events
     LEFT JOIN companies ON companies.id = audit_events.company_id
     ${companyFilter}
     ORDER BY audit_events.created_at DESC
     LIMIT 120`,
    params
  );
  res.json({ events });
});

app.post("/api/companies", requireAuth, requireRole("zow_owner"), async (req, res) => {
  await ensureCompaniesSchema();
  const now = new Date().toISOString();
  const membership = normalizeMembership(req.body);
  const company = {
    id: randomUUID(),
    name: String(req.body.name || "").trim(),
    slug: slugify(req.body.slug || req.body.name),
    plan: String(req.body.plan || "basico"),
    billingPeriod: membership.billingPeriod,
    status: String(req.body.status || "active"),
    maxUsers: Number(req.body.maxUsers || 10),
    maxUnits: Number(req.body.maxUnits || 10),
    storageMb: Number(req.body.storageMb || 1024),
    contactName: String(req.body.contactName || "").trim(),
    contactEmail: String(req.body.contactEmail || "").trim(),
    contactPhone: String(req.body.contactPhone || "").trim(),
    startsAt: membership.startsAt,
    endsAt: membership.endsAt,
    adminName: String(req.body.adminName || "Encargado de Sistema").trim(),
    adminUsername: normalizeUsername(req.body.adminUsername),
    adminPassword: String(req.body.adminPassword || "").trim(),
    sourceLeadId: String(req.body.sourceLeadId || "").trim(),
    systems: Array.isArray(req.body.systems) ? req.body.systems.map(String) : ["correspondencia"]
  };
  if (!company.name || !company.slug || !company.adminUsername || !company.adminPassword) return res.status(400).json({ error: "Faltan datos obligatorios" });
  const passwordError = validatePasswordStrength(company.adminPassword);
  if (passwordError) return res.status(400).json({ error: passwordError });
  if (!["active", "suspended", "cancelled"].includes(company.status)) return res.status(400).json({ error: "Estado invalido" });
  if (await pg.get("SELECT id FROM companies WHERE slug = ?", [company.slug])) return res.status(400).json({ error: "Ese identificador de empresa ya existe" });
  if (await pg.get("SELECT id FROM users WHERE lower(username) = lower(?)", [company.adminUsername])) return res.status(400).json({ error: "Ese usuario administrador ya existe" });
  const adminUnitId = randomUUID();
  const receptionUnitId = randomUUID();
  const adminUserId = randomUUID();
  await pg.tx(async (client) => {
    await client.run(
      `INSERT INTO companies (id, name, slug, plan, billing_period, status, max_users, max_units, storage_mb, contact_name, contact_email, contact_phone, starts_at, ends_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?::company_status, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [company.id, company.name, company.slug, company.plan, company.billingPeriod, company.status || "active", company.maxUsers, company.maxUnits, company.storageMb, company.contactName, company.contactEmail, company.contactPhone, company.startsAt, company.endsAt, now, now]
    );
    await client.run("INSERT INTO organization_settings (id, company_id, company_name, updated_at) VALUES (?, ?, ?, ?)", [company.id, company.id, company.name, now]);
    await client.run("INSERT INTO units (id, company_id, name, code, parent_unit_id, level) VALUES (?, ?, ?, ?, ?, ?)", [adminUnitId, company.id, "Administracion del Sistema", "ADM", "", "principal"]);
    await client.run("INSERT INTO units (id, company_id, name, code, parent_unit_id, level) VALUES (?, ?, ?, ?, ?, ?)", [receptionUnitId, company.id, "Recepcion Principal", "REC", "", "principal"]);
    await client.run(
      `INSERT INTO users (id, company_id, name, username, password_hash, role, unit_id, position, is_protected)
       VALUES (?, ?, ?, ?, ?, 'admin', ?, ?, true)`,
      [adminUserId, company.id, company.adminName, company.adminUsername, bcrypt.hashSync(company.adminPassword, 12), adminUnitId, "Encargado de sistema"]
    );
    for (const systemId of company.systems) {
      const system = await client.get("SELECT id FROM saas_systems WHERE id = ?", [systemId]);
      if (system) {
        await client.run(
          `INSERT INTO company_system_access (company_id, system_id, status, plan, starts_at, ends_at, updated_at)
           VALUES (?, ?, 'active', ?, ?, ?, ?)
           ON CONFLICT(company_id, system_id) DO UPDATE SET status = 'active', plan = excluded.plan, starts_at = excluded.starts_at, ends_at = excluded.ends_at, updated_at = excluded.updated_at`,
          [company.id, system.id, company.plan, company.startsAt, company.endsAt, now]
        );
      }
    }
    if (company.sourceLeadId) {
      await client.run("UPDATE leads SET status = 'convertido', updated_at = now() WHERE id = ?", [company.sourceLeadId]);
    }
  });
  await recordAuditEvent({ req, action: "company_create", entityType: "company", entityId: company.id, description: `Creo empresa ${company.name}` });
  if (company.sourceLeadId) {
    await recordAuditEvent({ req, action: "lead_convert", entityType: "lead", entityId: company.sourceLeadId, description: `Convirtio lead en empresa ${company.name}` });
  }
  res.status(201).json({ company: await pg.get("SELECT * FROM companies WHERE id = ?", [company.id]), adminUser: { id: adminUserId, username: company.adminUsername, name: company.adminName } });
});

app.patch("/api/companies/:id", requireAuth, requireRole("zow_owner"), async (req, res) => {
  await ensureCompaniesSchema();
  const existing = await pg.get("SELECT id FROM companies WHERE id = ? AND id <> 'zow-internal'", [req.params.id]);
  if (!existing) return res.status(404).json({ error: "Empresa no encontrada" });
  const now = new Date().toISOString();
  const membership = normalizeMembership(req.body);
  const company = {
    name: String(req.body.name || "").trim(),
    slug: slugify(req.body.slug || req.body.name),
    plan: String(req.body.plan || "basico"),
    billingPeriod: membership.billingPeriod,
    status: String(req.body.status || "active"),
    maxUsers: Number(req.body.maxUsers || 10),
    maxUnits: Number(req.body.maxUnits || 10),
    storageMb: Number(req.body.storageMb || 1024),
    contactName: String(req.body.contactName || "").trim(),
    contactEmail: String(req.body.contactEmail || "").trim(),
    contactPhone: String(req.body.contactPhone || "").trim(),
    startsAt: membership.startsAt,
    endsAt: membership.endsAt,
    adminUserId: String(req.body.adminUserId || "").trim(),
    adminName: String(req.body.adminName || "Encargado de Sistema").trim(),
    adminUsername: normalizeUsername(req.body.adminUsername),
    adminPassword: String(req.body.adminPassword || "").trim()
  };
  if (!company.name || !company.slug || !company.adminUsername) return res.status(400).json({ error: "Empresa y usuario encargado son obligatorios" });
  if (company.adminPassword) {
    const passwordError = validatePasswordStrength(company.adminPassword);
    if (passwordError) return res.status(400).json({ error: passwordError });
  }
  if (!["active", "suspended", "cancelled"].includes(company.status)) return res.status(400).json({ error: "Estado invalido" });
  const duplicateCompany = await pg.get("SELECT id FROM companies WHERE slug = ? AND id <> ?", [company.slug, existing.id]);
  if (duplicateCompany) return res.status(400).json({ error: "Ese identificador de empresa ya existe" });
  const adminUser =
    (company.adminUserId && (await pg.get("SELECT id FROM users WHERE id = ? AND company_id = ? AND role = 'admin'", [company.adminUserId, existing.id]))) ||
    (await pg.get("SELECT id FROM users WHERE company_id = ? AND role = 'admin' ORDER BY is_protected DESC, created_at ASC LIMIT 1", [existing.id]));
  if (!adminUser) return res.status(404).json({ error: "No se encontro el encargado de sistema" });
  const duplicateUser = await pg.get("SELECT id FROM users WHERE lower(username) = lower(?) AND id <> ?", [company.adminUsername, adminUser.id]);
  if (duplicateUser) return res.status(400).json({ error: "Ese usuario administrador ya existe" });

  await pg.tx(async (client) => {
    await client.run(
      `UPDATE companies
       SET name = ?, slug = ?, plan = ?, billing_period = ?, status = ?::company_status, max_users = ?, max_units = ?, storage_mb = ?,
           contact_name = ?, contact_email = ?, contact_phone = ?, starts_at = ?, ends_at = ?, updated_at = ?
       WHERE id = ?`,
      [
        company.name,
        company.slug,
        company.plan,
        company.billingPeriod,
        company.status,
        company.maxUsers,
        company.maxUnits,
        company.storageMb,
        company.contactName,
        company.contactEmail,
        company.contactPhone,
        company.startsAt,
        company.endsAt,
        now,
        existing.id
      ]
    );
    await client.run(
      `INSERT INTO organization_settings (id, company_id, company_name, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET company_name = excluded.company_name, updated_at = excluded.updated_at`,
      [existing.id, existing.id, company.name, now]
    );
    await client.run("UPDATE users SET name = ?, username = ?, phone = ? WHERE id = ?", [
      company.adminName,
      company.adminUsername,
      company.contactPhone,
      adminUser.id
    ]);
    if (company.adminPassword) await client.run("UPDATE users SET password_hash = ? WHERE id = ?", [bcrypt.hashSync(company.adminPassword, 12), adminUser.id]);
  });
  await recordAuditEvent({ req, action: "company_update", entityType: "company", entityId: existing.id, description: `Actualizo empresa ${company.name}`, metadata: { status: company.status, plan: company.plan } });
  res.json({ ok: true });
});

app.get("/api/systems", requireAuth, requireRole("zow_owner"), async (_req, res) => {
  await ensureSaasSystems();
  res.json({ systems: await pg.all("SELECT * FROM saas_systems WHERE id = ANY(?::text[]) ORDER BY name", [enabledPanelSystemIds]) });
});

app.get("/api/companies/:id/systems", requireAuth, requireRole("zow_owner"), async (req, res) => {
  await ensureSaasSystems();
  const company = await pg.get("SELECT id FROM companies WHERE id = ? AND id <> 'zow-internal'", [req.params.id]);
  if (!company) return res.status(404).json({ error: "Empresa no encontrada" });
  const systems = await pg.all(
    `SELECT saas_systems.*, COALESCE(company_system_access.status::text, 'inactive') AS access_status,
            COALESCE(company_system_access.plan, '') AS access_plan
     FROM saas_systems
     LEFT JOIN company_system_access ON company_system_access.system_id = saas_systems.id AND company_system_access.company_id = ?
     WHERE saas_systems.id = ANY(?::text[])
     ORDER BY saas_systems.name`,
    [company.id, enabledPanelSystemIds]
  );
  res.json({ systems });
});

app.patch("/api/companies/:id/systems", requireAuth, requireRole("zow_owner"), async (req, res) => {
  const company = await pg.get("SELECT id FROM companies WHERE id = ? AND id <> 'zow-internal'", [req.params.id]);
  if (!company) return res.status(404).json({ error: "Empresa no encontrada" });
  const enabledSystems = Array.isArray(req.body.systems) ? req.body.systems.map(String) : [];
  const plan = String(req.body.plan || "basico");
  const now = new Date().toISOString();
  const systems = await pg.all("SELECT id FROM saas_systems");
  for (const system of systems) {
    await pg.run(
      `INSERT INTO company_system_access (company_id, system_id, status, plan, updated_at)
       VALUES (?, ?, ?::system_status, ?, ?)
       ON CONFLICT(company_id, system_id) DO UPDATE SET status = excluded.status, plan = excluded.plan, updated_at = excluded.updated_at`,
      [company.id, system.id, enabledSystems.includes(system.id) ? "active" : "inactive", plan, now]
    );
  }
  await recordAuditEvent({
    req,
    action: "company_systems_update",
    entityType: "company",
    entityId: company.id,
    description: "Actualizo accesos SaaS de empresa",
    metadata: { systems: enabledSystems, plan }
  });
  res.json({ ok: true });
});

app.get("/api/ventas/summary", requireAuth, async (req, res) => {
  if (!(await requireSystemAccess("ventas_almacen", req, res))) return;
  await ensureVentasSchema();
  const ownOnly = ventasOwnOnly(req.user.role);
  const inventory = await pg.get(
    `SELECT COUNT(*) AS products,
            COALESCE(SUM(stock), 0) AS stock,
            COALESCE(SUM(stock * cost_price), 0) AS inventory_value,
            COALESCE(SUM(CASE WHEN stock <= min_stock THEN 1 ELSE 0 END), 0) AS low_stock
     FROM inventory_products
     WHERE company_id = ? AND is_active = true`,
    [req.user.company_id]
  );
  const sales = await pg.get(
    `SELECT COUNT(*) AS sales, COALESCE(SUM(total), 0) AS income
     FROM sales_orders
     WHERE company_id = ? AND status = 'confirmada' ${ownOnly ? "AND created_by = ?" : ""}`,
    ownOnly ? [req.user.company_id, req.user.id] : [req.user.company_id]
  );
  const pendingCash = await pg.get(
    `SELECT COUNT(*) AS pending_sales, COALESCE(SUM(total), 0) AS pending_total
     FROM sales_orders
     WHERE company_id = ? AND status = 'confirmada' AND cash_closed = false ${ownOnly ? "AND created_by = ?" : ""}`,
    ownOnly ? [req.user.company_id, req.user.id] : [req.user.company_id]
  );
  res.json({ summary: { ...inventory, ...sales, ...pendingCash } });
});

app.get("/api/ventas/settings", requireAuth, async (req, res) => {
  if (!(await requireSystemAccess("ventas_almacen", req, res))) return;
  res.json({ settings: await mapSettings(await loadSettings(req.user.company_id)) });
});

app.patch("/api/ventas/settings", requireAuth, async (req, res) => {
  if (!(await requireSystemAccess("ventas_almacen", req, res))) return;
  if (!requireVentasRole(req, res, "admin", "ventas_admin")) return;
  await ensureSettingsSchema();
  const current = await mapSettings(await loadSettings(req.user.company_id));
  const settings = {
    companyName: String(req.body.companyName || current.companyName || "").trim(),
    storeName: String(req.body.storeName || "").trim(),
    currency: String(req.body.currency || current.currency || "BOB").trim().toUpperCase().slice(0, 8),
    taxId: String(req.body.taxId || "").trim(),
    phone: String(req.body.phone || "").trim(),
    address: String(req.body.address || "").trim(),
    ticketNote: String(req.body.ticketNote || "").trim()
  };
  if (!settings.companyName) return res.status(400).json({ error: "Nombre de empresa obligatorio" });
  if (!settings.currency) return res.status(400).json({ error: "Moneda obligatoria" });
  await pg.run(
    `INSERT INTO organization_settings (
       id, company_id, company_name, store_name, currency, tax_id, phone, address, ticket_note, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, now())
     ON CONFLICT(id) DO UPDATE SET
       company_name = excluded.company_name,
       store_name = excluded.store_name,
       currency = excluded.currency,
       tax_id = excluded.tax_id,
       phone = excluded.phone,
       address = excluded.address,
       ticket_note = excluded.ticket_note,
       updated_at = now()`,
    [req.user.company_id, req.user.company_id, settings.companyName, settings.storeName, settings.currency, settings.taxId, settings.phone, settings.address, settings.ticketNote]
  );
  res.json({ settings: await mapSettings(await loadSettings(req.user.company_id)) });
});

app.get("/api/ventas/products", requireAuth, async (req, res) => {
  if (!(await requireSystemAccess("ventas_almacen", req, res))) return;
  await ensureVentasSchema();
  const products = await pg.all("SELECT * FROM inventory_products WHERE company_id = ? ORDER BY name", [req.user.company_id]);
  res.json({ products });
});

app.post("/api/ventas/products", requireAuth, async (req, res) => {
  if (!(await requireSystemAccess("ventas_almacen", req, res))) return;
  if (!requireVentasRole(req, res, "admin", "ventas_admin", "almacen")) return;
  await ensureVentasSchema();
  const product = {
    id: randomUUID(),
    code: String(req.body.code || "").trim().toUpperCase(),
    name: String(req.body.name || "").trim(),
    category: String(req.body.category || "").trim(),
    unit: String(req.body.unit || "Unidad").trim(),
    costPrice: Number(req.body.costPrice || 0),
    salePrice: Number(req.body.salePrice || 0),
    minStock: Number(req.body.minStock || 0),
    stock: Number(req.body.stock || 0)
  };
  if (!product.code || !product.name) return res.status(400).json({ error: "Codigo y nombre son obligatorios" });
  await pg.tx(async (client) => {
    await client.run(
      `INSERT INTO inventory_products (id, company_id, code, name, category, unit, cost_price, sale_price, min_stock, stock, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, now(), now())`,
      [product.id, req.user.company_id, product.code, product.name, product.category, product.unit, product.costPrice, product.salePrice, product.minStock, product.stock]
    );
    if (product.stock !== 0) {
      await client.run(
        `INSERT INTO inventory_movements (id, company_id, product_id, type, quantity, reference, note, created_by, created_at)
         VALUES (?, ?, ?, 'entrada', ?, ?, ?, ?, now())`,
        [randomUUID(), req.user.company_id, product.id, product.stock, "Stock inicial", "Registro inicial de producto", req.user.id]
      );
    }
  });
  res.status(201).json({ product: await pg.get("SELECT * FROM inventory_products WHERE id = ?", [product.id]) });
});

app.get("/api/ventas/categories", requireAuth, async (req, res) => {
  if (!(await requireSystemAccess("ventas_almacen", req, res))) return;
  await ensureVentasSchema();
  const categories = await pg.all("SELECT * FROM inventory_categories WHERE company_id = ? ORDER BY name", [req.user.company_id]);
  res.json({ categories });
});

app.post("/api/ventas/categories", requireAuth, async (req, res) => {
  if (!(await requireSystemAccess("ventas_almacen", req, res))) return;
  if (!requireVentasRole(req, res, "admin", "ventas_admin", "almacen")) return;
  await ensureVentasSchema();
  const category = {
    id: randomUUID(),
    name: String(req.body.name || "").trim(),
    description: String(req.body.description || "").trim()
  };
  if (!category.name) return res.status(400).json({ error: "Nombre de categoria obligatorio" });
  await pg.run("INSERT INTO inventory_categories (id, company_id, name, description) VALUES (?, ?, ?, ?)", [category.id, req.user.company_id, category.name, category.description]);
  res.status(201).json({ category });
});

app.get("/api/ventas/customers", requireAuth, async (req, res) => {
  if (!(await requireSystemAccess("ventas_almacen", req, res))) return;
  await ensureVentasSchema();
  const customers = await pg.all("SELECT * FROM sales_customers WHERE company_id = ? ORDER BY name", [req.user.company_id]);
  res.json({ customers });
});

app.post("/api/ventas/customers", requireAuth, async (req, res) => {
  if (!(await requireSystemAccess("ventas_almacen", req, res))) return;
  if (!requireVentasRole(req, res, "admin", "ventas_admin", "cajero", "vendedor")) return;
  await ensureVentasSchema();
  const customer = {
    id: randomUUID(),
    name: String(req.body.name || "").trim(),
    phone: String(req.body.phone || "").trim(),
    ci: String(req.body.ci || "").trim(),
    email: String(req.body.email || "").trim(),
    address: String(req.body.address || "").trim()
  };
  if (!customer.name) return res.status(400).json({ error: "Nombre de cliente obligatorio" });
  await pg.run(
    `INSERT INTO sales_customers (id, company_id, name, phone, ci, email, address, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, now(), now())`,
    [customer.id, req.user.company_id, customer.name, customer.phone, customer.ci, customer.email, customer.address]
  );
  res.status(201).json({ customer });
});

app.get("/api/ventas/sales", requireAuth, async (req, res) => {
  if (!(await requireSystemAccess("ventas_almacen", req, res))) return;
  await ensureVentasSchema();
  const ownOnly = ventasOwnOnly(req.user.role);
  const sales = await pg.all(
    `SELECT sales_orders.*, users.name AS seller_name
     FROM sales_orders
     LEFT JOIN users ON users.id = sales_orders.created_by
     WHERE sales_orders.company_id = ? ${ownOnly ? "AND sales_orders.created_by = ?" : ""}
     ORDER BY sales_orders.created_at DESC`,
    ownOnly ? [req.user.company_id, req.user.id] : [req.user.company_id]
  );
  res.json({ sales });
});

app.get("/api/ventas/sales/:id", requireAuth, async (req, res) => {
  if (!(await requireSystemAccess("ventas_almacen", req, res))) return;
  await ensureVentasSchema();
  const sale = await pg.get("SELECT * FROM sales_orders WHERE id = ? AND company_id = ?", [req.params.id, req.user.company_id]);
  if (!sale) return res.status(404).json({ error: "Venta no encontrada" });
  if (ventasOwnOnly(req.user.role) && sale.created_by !== req.user.id) return res.status(403).json({ error: "Permiso insuficiente" });
  const items = await pg.all("SELECT * FROM sales_order_items WHERE sale_id = ? AND company_id = ?", [sale.id, req.user.company_id]);
  res.json({ sale, items });
});

app.post("/api/ventas/sales/:id/void", requireAuth, async (req, res) => {
  if (!(await requireSystemAccess("ventas_almacen", req, res))) return;
  if (!requireVentasRole(req, res, "admin", "ventas_admin", "supervisor", "cajero", "vendedor")) return;
  await ensureVentasSchema();
  const sale = await pg.get("SELECT * FROM sales_orders WHERE id = ? AND company_id = ?", [req.params.id, req.user.company_id]);
  if (!sale) return res.status(404).json({ error: "Venta no encontrada" });
  if (ventasOwnOnly(req.user.role) && sale.created_by !== req.user.id) return res.status(403).json({ error: "Permiso insuficiente" });
  if (sale.status === "anulada") return res.status(400).json({ error: "La venta ya fue anulada" });
  if (sale.cash_closed) return res.status(400).json({ error: "No se puede anular una venta con caja cerrada" });
  const items = await pg.all("SELECT * FROM sales_order_items WHERE sale_id = ? AND company_id = ?", [sale.id, req.user.company_id]);
  try {
    await pg.tx(async (client) => {
      await client.run("UPDATE sales_orders SET status = 'anulada' WHERE id = ? AND company_id = ?", [sale.id, req.user.company_id]);
      for (const item of items) {
        if (!item.product_id) continue;
        const quantity = Number(item.quantity || 0);
        if (quantity <= 0) continue;
        await client.run(
          "UPDATE inventory_products SET stock = stock + ?, updated_at = now() WHERE id = ? AND company_id = ?",
          [quantity, item.product_id, req.user.company_id]
        );
        await client.run(
          `INSERT INTO inventory_movements (id, company_id, product_id, type, quantity, reference, note, created_by, created_at)
           VALUES (?, ?, ?, 'entrada', ?, ?, ?, ?, now())`,
          [randomUUID(), req.user.company_id, item.product_id, quantity, sale.code, "Anulacion de venta: stock devuelto", req.user.id]
        );
      }
    });
    res.json({
      sale: await pg.get("SELECT * FROM sales_orders WHERE id = ? AND company_id = ?", [sale.id, req.user.company_id]),
      items
    });
  } catch (error) {
    res.status(400).json({ error: error.message || "No se pudo anular la venta" });
  }
});

app.post("/api/ventas/sales", requireAuth, async (req, res) => {
  if (!(await requireSystemAccess("ventas_almacen", req, res))) return;
  if (!requireVentasRole(req, res, "admin", "ventas_admin", "cajero", "vendedor")) return;
  await ensureVentasSchema();
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({ error: "Agrega al menos un producto a la venta" });
  const saleId = randomUUID();
  const customerId = String(req.body.customerId || "").trim();
  try {
    const result = await pg.tx(async (client) => {
      const saleCode = await buildNextSaleCode(req.user.company_id, new Date().toISOString(), client);
      const customer = customerId ? await client.get("SELECT * FROM sales_customers WHERE id = ? AND company_id = ?", [customerId, req.user.company_id]) : null;
      const customerName = customer?.name || String(req.body.customerName || "Cliente sin registrar").trim();
      const preparedItems = [];
      for (const item of items) {
        const product = await client.get("SELECT * FROM inventory_products WHERE id = ? AND company_id = ? AND is_active = true", [String(item.productId || ""), req.user.company_id]);
        const quantity = Number(item.quantity || 0);
        if (!product || quantity <= 0) throw new Error("Producto o cantidad invalida");
        if (Number(product.stock) < quantity) throw new Error(`Stock insuficiente para ${product.name}`);
        const unitPrice = Number(item.unitPrice || product.sale_price || 0);
        preparedItems.push({ product, quantity, unitPrice, total: quantity * unitPrice });
      }
      const subtotal = preparedItems.reduce((total, item) => total + item.total, 0);
      const discount = Number(req.body.discount || 0);
      const total = Math.max(subtotal - discount, 0);
      const cashReceived = Number(req.body.cashReceived || total);
      const changeAmount = Math.max(cashReceived - total, 0);
      await client.run(
        `INSERT INTO sales_orders (
          id, company_id, code, customer_id, customer_name, subtotal, discount, total,
          cash_received, change_amount, status, cash_closed, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmada', false, ?, now())`,
        [saleId, req.user.company_id, saleCode, customer?.id || null, customerName, subtotal, discount, total, cashReceived, changeAmount, req.user.id]
      );
      for (const item of preparedItems) {
        await client.run(
          `INSERT INTO sales_order_items (id, company_id, sale_id, product_id, product_name, quantity, unit_price, total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [randomUUID(), req.user.company_id, saleId, item.product.id, item.product.name, item.quantity, item.unitPrice, item.total]
        );
        await client.run(
          `INSERT INTO inventory_movements (id, company_id, product_id, type, quantity, reference, note, created_by, created_at)
           VALUES (?, ?, ?, 'salida', ?, ?, ?, ?, now())`,
          [randomUUID(), req.user.company_id, item.product.id, item.quantity, saleCode, "Venta confirmada", req.user.id]
        );
        await client.run("UPDATE inventory_products SET stock = stock - ?, updated_at = now() WHERE id = ? AND company_id = ?", [item.quantity, item.product.id, req.user.company_id]);
      }
      return { saleCode };
    });
    res.status(201).json({
      sale: await pg.get("SELECT * FROM sales_orders WHERE id = ?", [saleId]),
      items: await pg.all("SELECT * FROM sales_order_items WHERE sale_id = ?", [saleId]),
      code: result.saleCode
    });
  } catch (error) {
    res.status(400).json({ error: error.message || "No se pudo registrar la venta" });
  }
});

app.get("/api/ventas/cash", requireAuth, async (req, res) => {
  if (!(await requireSystemAccess("ventas_almacen", req, res))) return;
  await ensureVentasSchema();
  const ownOnly = ventasOwnOnly(req.user.role);
  const pendingSales = await pg.all(
    `SELECT * FROM sales_orders WHERE company_id = ? AND status = 'confirmada' AND cash_closed = false ${ownOnly ? "AND created_by = ?" : ""} ORDER BY created_at DESC`,
    ownOnly ? [req.user.company_id, req.user.id] : [req.user.company_id]
  );
  const total = pendingSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  res.json({ pendingSales, total });
});

app.post("/api/ventas/cash/close", requireAuth, async (req, res) => {
  if (!(await requireSystemAccess("ventas_almacen", req, res))) return;
  if (!requireVentasRole(req, res, "admin", "ventas_admin", "cajero")) return;
  await ensureVentasSchema();
  const ownOnly = ventasOwnOnly(req.user.role);
  const pendingSales = await pg.all(
    `SELECT * FROM sales_orders WHERE company_id = ? AND status = 'confirmada' AND cash_closed = false ${ownOnly ? "AND created_by = ?" : ""}`,
    ownOnly ? [req.user.company_id, req.user.id] : [req.user.company_id]
  );
  if (!pendingSales.length) return res.status(400).json({ error: "No hay ventas pendientes de cierre" });
  const closureId = randomUUID();
  const total = pendingSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const code = await buildNextCashCode(req.user.company_id);
  await pg.tx(async (client) => {
    await client.run(
      `INSERT INTO cash_closures (id, company_id, code, total_sales, sale_count, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, now())`,
      [closureId, req.user.company_id, code, total, pendingSales.length, req.user.id]
    );
    await client.run(
      `UPDATE sales_orders SET cash_closed = true WHERE company_id = ? AND status = 'confirmada' AND cash_closed = false ${ownOnly ? "AND created_by = ?" : ""}`,
      ownOnly ? [req.user.company_id, req.user.id] : [req.user.company_id]
    );
  });
  res.status(201).json({ closure: await pg.get("SELECT * FROM cash_closures WHERE id = ?", [closureId]) });
});

app.get("/api/ventas/cash/history", requireAuth, async (req, res) => {
  if (!(await requireSystemAccess("ventas_almacen", req, res))) return;
  await ensureVentasSchema();
  const ownOnly = ventasOwnOnly(req.user.role);
  const closures = await pg.all(
    `SELECT * FROM cash_closures WHERE company_id = ? ${ownOnly ? "AND created_by = ?" : ""} ORDER BY created_at DESC`,
    ownOnly ? [req.user.company_id, req.user.id] : [req.user.company_id]
  );
  res.json({ closures });
});

app.post("/api/ventas/products/:id/movements", requireAuth, async (req, res) => {
  if (!(await requireSystemAccess("ventas_almacen", req, res))) return;
  if (!requireVentasRole(req, res, "admin", "ventas_admin", "almacen")) return;
  await ensureVentasSchema();
  const product = await pg.get("SELECT * FROM inventory_products WHERE id = ? AND company_id = ?", [req.params.id, req.user.company_id]);
  if (!product) return res.status(404).json({ error: "Producto no encontrado" });
  const type = String(req.body.type || "entrada");
  const quantity = Number(req.body.quantity || 0);
  if (!["entrada", "salida", "ajuste"].includes(type) || quantity <= 0) return res.status(400).json({ error: "Movimiento invalido" });
  const signedQuantity = type === "salida" ? -quantity : quantity;
  await pg.tx(async (client) => {
    await client.run(
      `INSERT INTO inventory_movements (id, company_id, product_id, type, quantity, reference, note, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, now())`,
      [randomUUID(), req.user.company_id, product.id, type, quantity, String(req.body.reference || ""), String(req.body.note || ""), req.user.id]
    );
    await client.run("UPDATE inventory_products SET stock = stock + ?, updated_at = now() WHERE id = ?", [signedQuantity, product.id]);
  });
  res.json({ product: await pg.get("SELECT * FROM inventory_products WHERE id = ?", [product.id]) });
});

app.patch("/api/companies/:id/status", requireAuth, requireRole("zow_owner"), async (req, res) => {
  const status = String(req.body.status || "").trim();
  if (!["active", "suspended", "cancelled"].includes(status)) return res.status(400).json({ error: "Estado invalido" });
  const company = await pg.get("SELECT id FROM companies WHERE id = ? AND id <> 'zow-internal'", [req.params.id]);
  if (!company) return res.status(404).json({ error: "Empresa no encontrada" });
  await pg.run("UPDATE companies SET status = ?::company_status, updated_at = now() WHERE id = ?", [status, company.id]);
  await recordAuditEvent({
    req,
    action: "company_status",
    entityType: "company",
    entityId: company.id,
    description: `Cambio estado de empresa a ${status}`
  });
  res.json({ ok: true });
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: "El archivo excede los limites permitidos." });
  }
  if (error?.message === "Origen no permitido por ZOW") {
    return res.status(403).json({ error: "Origen no permitido" });
  }
  if (error?.message?.startsWith("Solo se permiten") || error?.message?.startsWith("El logo")) {
    return res.status(400).json({ error: error.message });
  }
  return res.status(500).json({ error: "Error de servidor" });
});

const port = Number(process.env.PORT || 4174);
if (require.main === module) app.listen(port, () => console.log(`ZOW PostgreSQL backend listo en http://localhost:${port}`));

module.exports = app;

function publicUser(user) {
  return {
    id: user.id,
    companyId: user.company_id,
    companyName: user.company_name || "",
    companySlug: user.company_slug || "",
    name: user.name,
    username: user.username,
    role: user.role,
    unitId: user.unit_id,
    unitName: user.unit_name,
    position: user.position,
    ci: user.ci || "",
    phone: user.phone || "",
    companyPlan: user.plan || "",
    billingPeriod: user.billing_period || "",
    membershipStartsAt: user.starts_at || "",
    membershipEndsAt: user.ends_at || "",
    companyStatus: user.company_status || ""
  };
}

function readUserPayload(body) {
  return {
    name: String(body.name || "").trim(),
    username: normalizeUsername(body.username),
    role: String(body.role || "funcionario"),
    unitId: String(body.unitId || "").trim(),
    position: String(body.position || "").trim(),
    ci: String(body.ci || "").trim(),
    phone: String(body.phone || "").trim()
  };
}

function readLeadPayload(body) {
  return {
    id: randomUUID(),
    name: String(body.name || "").trim().slice(0, 140),
    company: String(body.company || "").trim().slice(0, 160),
    phone: String(body.phone || "").trim().slice(0, 60),
    email: String(body.email || "").trim().toLowerCase().slice(0, 160),
    systemId: String(body.system || body.systemId || "").trim().slice(0, 80),
    plan: String(body.plan || "").trim().slice(0, 40),
    message: String(body.message || "").trim().slice(0, 1000)
  };
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function getUploadedFiles(req) {
  if (!req.files) return [];
  if (Array.isArray(req.files)) return req.files;
  return [...(req.files.digitalFile || []), ...(req.files.digitalFiles || [])];
}

function fileFilterForDocuments(_req, file, callback) {
  const allowedMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
  if (allowedMimeTypes.has(file.mimetype)) return callback(null, true);
  return callback(new Error("Solo se permiten archivos PDF o imagenes JPG, PNG y WEBP."));
}

function fileFilterForLogo(_req, file, callback) {
  if (file.mimetype === "image/png") return callback(null, true);
  return callback(new Error("El logo institucional debe ser PNG."));
}

async function attachUploadedFiles({ files, companyId, documentId, userId, uploadedAt }) {
  if (!files.length) return;
  for (const file of files) {
    const id = randomUUID();
    const storagePath = `${companyId}/${documentId}/${id}-${sanitizeFileName(file.originalname)}`;
    if (supabase) {
      const { error } = await supabase.storage.from(storageBucket).upload(storagePath, file.buffer, {
        contentType: file.mimetype || "application/octet-stream",
        upsert: false
      });
      if (error) throw error;
    }
    await pg.run(
      `INSERT INTO document_files (id, company_id, document_id, original_name, stored_name, storage_bucket, storage_path, size, mime_type, uploaded_by, uploaded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, companyId, documentId, file.originalname, storagePath, storageBucket, storagePath, file.size || 0, file.mimetype || "", userId, uploadedAt]
    );
  }
}

function buildDerivationComment(unitName, comment) {
  const detail = String(comment || "").trim();
  return `Destino: ${unitName}. ${detail || "Sin comentario adicional."}`;
}

async function loadSettings(companyId) {
  await ensureSettingsSchema();
  return pg.get("SELECT * FROM organization_settings WHERE company_id = ? OR id = ? ORDER BY (id = ?) DESC LIMIT 1", [companyId, companyId, companyId]);
}

async function mapSettings(settings = {}) {
  const logoUrl = await buildLogoUrl(settings);
  return {
    companyName: settings?.company_name || "Empresa sin configurar",
    storeName: settings?.store_name || "",
    currency: settings?.currency || "BOB",
    taxId: settings?.tax_id || "",
    phone: settings?.phone || "",
    address: settings?.address || "",
    ticketNote: settings?.ticket_note || "",
    logoName: settings?.logo_name || "",
    logoUrl
  };
}

async function buildLogoUrl(settings = {}) {
  if (!settings?.logo_path || !supabase) return "";
  const { data, error } = await supabase.storage
    .from(settings.logo_bucket || storageBucket)
    .createSignedUrl(settings.logo_path, 60 * 60);
  return error ? "" : data?.signedUrl || "";
}

let settingsSchemaReady;
async function ensureSettingsSchema() {
  if (!settingsSchemaReady) {
    settingsSchemaReady = Promise.all([
      pg.run("ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS logo_bucket text not null default ''"),
      pg.run("ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS logo_path text not null default ''"),
      pg.run("ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS logo_name text not null default ''"),
      pg.run("ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS logo_mime text not null default ''"),
      pg.run("ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS logo_updated_at timestamptz")
    ]);
  }
  await settingsSchemaReady;
}

let companiesSchemaReady;
async function ensureCompaniesSchema() {
  if (!companiesSchemaReady) {
    companiesSchemaReady = (async () => {
      await pg.run("ALTER TABLE companies ADD COLUMN IF NOT EXISTS billing_period text not null default 'mensual'");
      await pg.run("ALTER TABLE companies ADD COLUMN IF NOT EXISTS starts_at text not null default ''");
      await pg.run("ALTER TABLE companies ADD COLUMN IF NOT EXISTS ends_at text not null default ''");
    })();
  }
  await companiesSchemaReady;
}

let publicLookupAuditSchemaReady = null;

async function ensurePublicLookupAuditSchema() {
  if (!publicLookupAuditSchemaReady) {
    publicLookupAuditSchemaReady = (async () => {
      await pg.run(`
        CREATE TABLE IF NOT EXISTS public_lookup_audit (
          id text primary key,
          company_id text,
          document_id text,
          code text not null default '',
          ci_hash text not null default '',
          ip_address text not null default '',
          user_agent text not null default '',
          found boolean not null default false,
          created_at timestamptz not null default now()
        )
      `);
      await pg.run("CREATE INDEX IF NOT EXISTS idx_public_lookup_audit_created ON public_lookup_audit(created_at)");
      await pg.run("CREATE INDEX IF NOT EXISTS idx_public_lookup_audit_company ON public_lookup_audit(company_id)");
    })();
  }
  await publicLookupAuditSchemaReady;
}

async function recordPublicLookup(req, code, ci, documentItem) {
  await pg.run(
    `INSERT INTO public_lookup_audit (id, company_id, document_id, code, ci_hash, ip_address, user_agent, found, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, now())`,
    [
      randomUUID(),
      documentItem?.company_id || null,
      documentItem?.id || null,
      code,
      hashLookupValue(ci),
      getRequestIp(req),
      String(req.headers["user-agent"] || "").slice(0, 260),
      Boolean(documentItem)
    ]
  );
}

let auditSchemaReady = null;

async function ensureAuditSchema() {
  if (!auditSchemaReady) {
    auditSchemaReady = (async () => {
      await pg.run(`
        CREATE TABLE IF NOT EXISTS audit_events (
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
        )
      `);
      await pg.run("CREATE INDEX IF NOT EXISTS idx_audit_events_company ON audit_events(company_id, created_at DESC)");
      await pg.run("CREATE INDEX IF NOT EXISTS idx_audit_events_action ON audit_events(action)");
    })();
  }
  await auditSchemaReady;
}

async function recordAuditEvent({ req, action, entityType = "", entityId = "", description = "", metadata = {} }) {
  await ensureAuditSchema();
  await pg.run(
    `INSERT INTO audit_events (id, company_id, actor_user_id, actor_name, action, entity_type, entity_id, description, metadata, ip_address, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, now())`,
    [
      randomUUID(),
      req.user?.company_id || null,
      req.user?.id || null,
      req.user?.name || "",
      action,
      entityType,
      entityId,
      description,
      JSON.stringify(metadata || {}),
      getRequestIp(req)
    ]
  );
}

let leadsSchemaReady = null;

async function ensureLeadsSchema() {
  if (!leadsSchemaReady) {
    leadsSchemaReady = (async () => {
      await pg.run(`
        CREATE TABLE IF NOT EXISTS leads (
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
        )
      `);
      await pg.run(`
        CREATE TABLE IF NOT EXISTS lead_history (
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
        )
      `);
      await pg.run("ALTER TABLE leads ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT ''");
      await pg.run("ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_action text NOT NULL DEFAULT ''");
      await pg.run("ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_action_at text NOT NULL DEFAULT ''");
      await pg.run("ALTER TABLE leads ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'media'");
      await pg.run("CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status, created_at DESC)");
      await pg.run("CREATE INDEX IF NOT EXISTS idx_leads_priority ON leads(priority, created_at DESC)");
      await pg.run("CREATE INDEX IF NOT EXISTS idx_lead_history_lead ON lead_history(lead_id, created_at DESC)");
    })();
  }
  await leadsSchemaReady;
}

async function recordLeadHistory({ req, leadId, status = "", priority = "", nextAction = "", nextActionAt = "", notes = "", description = "" }) {
  await pg.run(
    `INSERT INTO lead_history (id, lead_id, actor_user_id, actor_name, status, priority, next_action, next_action_at, notes, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      leadId,
      req.user?.id || null,
      req.user?.name || "",
      status,
      priority,
      nextAction,
      nextActionAt,
      notes,
      description
    ]
  );
}

function normalizeLeadPriority(value) {
  const allowed = new Set(["baja", "media", "alta", "urgente"]);
  const normalized = String(value || "media").trim().toLowerCase();
  return allowed.has(normalized) ? normalized : "media";
}

function buildLeadHistoryDescription(previous = {}, next = {}) {
  const changes = [];
  if (next.status && next.status !== previous.status) changes.push(`estado: ${next.status}`);
  if (next.priority && next.priority !== previous.priority) changes.push(`prioridad: ${next.priority}`);
  if ((next.nextAction || "") !== (previous.next_action || "")) changes.push("proxima accion actualizada");
  if ((next.nextActionAt || "") !== (previous.next_action_at || "")) changes.push("fecha de accion actualizada");
  if ((next.notes || "") !== (previous.notes || "")) changes.push("notas actualizadas");
  return changes.length ? changes.join(", ") : "Seguimiento actualizado";
}

async function suspendExpiredCompanies() {
  await pg.run(
    `UPDATE companies
     SET status = 'suspended', updated_at = now()
     WHERE status = 'active'
       AND COALESCE(NULLIF(ends_at, ''), '') <> ''
       AND NULLIF(ends_at, '')::date < CURRENT_DATE`
  );
}

function normalizeMembership(body = {}) {
  const billingPeriod = normalizeBillingPeriod(body.billingPeriod || body.billing_period || "mensual");
  const startsAt = normalizeDateInput(body.startsAt) || todayIsoDate();
  const explicitEnd = normalizeDateInput(body.endsAt);
  return {
    billingPeriod,
    startsAt,
    endsAt: explicitEnd || addPeriod(startsAt, billingPeriod)
  };
}

function normalizeBillingPeriod(value) {
  const allowed = new Set(["mensual", "trimestral", "semestral", "anual"]);
  const normalized = String(value || "mensual").trim().toLowerCase();
  return allowed.has(normalized) ? normalized : "mensual";
}

function normalizeDateInput(value) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function hashLookupValue(value) {
  return createHash("sha256").update(String(value || "").trim().toLowerCase()).digest("hex");
}

function getRequestIp(req) {
  return String(req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim()
    .slice(0, 80);
}

function addPeriod(startDate, billingPeriod) {
  const date = new Date(`${startDate}T00:00:00`);
  const monthsByPeriod = { mensual: 1, trimestral: 3, semestral: 6, anual: 12 };
  date.setMonth(date.getMonth() + (monthsByPeriod[billingPeriod] || 1));
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

async function getDocumentById(id, companyId) {
  return pg.get(
    `SELECT documents.*,
            COALESCE((SELECT COUNT(*)::int FROM document_files WHERE document_files.company_id = documents.company_id AND document_files.document_id = documents.id), 0) AS digital_file_count,
            COALESCE((SELECT STRING_AGG(original_name, ', ') FROM document_files WHERE document_files.company_id = documents.company_id AND document_files.document_id = documents.id), documents.digital_file_name) AS digital_file_names
     FROM documents
     WHERE documents.id = ? AND documents.company_id = ?`,
    [id, companyId]
  );
}

async function requireSystemAccess(systemId, req, res) {
  if (req.user.role === "zow_owner") {
    res.status(403).json({ error: "El panel ZOW no opera sistemas de empresas" });
    return false;
  }
  const access = await pg.get("SELECT status FROM company_system_access WHERE company_id = ? AND system_id = ?", [req.user.company_id, systemId]);
  if (!access || access.status !== "active") {
    res.status(403).json({ error: "La empresa no tiene acceso activo a este sistema" });
    return false;
  }
  return true;
}

function requireVentasRole(req, res, ...roles) {
  if (!roles.includes(req.user.role)) {
    res.status(403).json({ error: "Este rol no tiene permiso para esta funcion de Ventas-Almacen" });
    return false;
  }
  return true;
}

function ventasOwnOnly(role) {
  return !["admin", "ventas_admin", "supervisor"].includes(role);
}

let ventasSchemaReady;
async function ensureVentasSchema() {
  if (!ventasSchemaReady) {
    ventasSchemaReady = (async () => {
      await pg.run(`
        CREATE TABLE IF NOT EXISTS inventory_products (
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
        )
      `);
      await pg.run(`
        CREATE TABLE IF NOT EXISTS inventory_categories (
          id text primary key,
          company_id text not null references companies(id) on delete cascade,
          name text not null,
          description text not null default '',
          unique (company_id, name)
        )
      `);
      await pg.run(`
        CREATE TABLE IF NOT EXISTS sales_customers (
          id text primary key,
          company_id text not null references companies(id) on delete cascade,
          name text not null,
          phone text not null default '',
          ci text not null default '',
          email text not null default '',
          address text not null default '',
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
      `);
      await pg.run(`
        CREATE TABLE IF NOT EXISTS sales_orders (
          id text primary key,
          company_id text not null references companies(id) on delete cascade,
          code text not null,
          customer_id text references sales_customers(id),
          customer_name text not null default '',
          subtotal numeric not null default 0,
          discount numeric not null default 0,
          total numeric not null default 0,
          cash_received numeric not null default 0,
          change_amount numeric not null default 0,
          status text not null default 'confirmada',
          cash_closed boolean not null default false,
          created_by text not null references users(id),
          created_at timestamptz not null default now(),
          unique (company_id, code)
        )
      `);
      await pg.run(`
        CREATE TABLE IF NOT EXISTS sales_order_items (
          id text primary key,
          company_id text not null references companies(id) on delete cascade,
          sale_id text not null references sales_orders(id) on delete cascade,
          product_id text references inventory_products(id),
          product_name text not null,
          quantity numeric not null default 0,
          unit_price numeric not null default 0,
          total numeric not null default 0
        )
      `);
      await pg.run(`
        CREATE TABLE IF NOT EXISTS cash_closures (
          id text primary key,
          company_id text not null references companies(id) on delete cascade,
          code text not null,
          total_sales numeric not null default 0,
          sale_count integer not null default 0,
          created_by text not null references users(id),
          created_at timestamptz not null default now(),
          unique (company_id, code)
        )
      `);
      await pg.run(`
        CREATE TABLE IF NOT EXISTS inventory_movements (
          id text primary key,
          company_id text not null references companies(id) on delete cascade,
          product_id text not null references inventory_products(id) on delete cascade,
          type text not null,
          quantity numeric not null default 0,
          reference text not null default '',
          note text not null default '',
          created_by text not null references users(id),
          created_at timestamptz not null default now()
        )
      `);
      await pg.run("CREATE INDEX IF NOT EXISTS idx_inventory_products_company ON inventory_products(company_id, name)");
      await pg.run("CREATE INDEX IF NOT EXISTS idx_sales_orders_company ON sales_orders(company_id, created_at DESC)");
      await pg.run("CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id, created_at DESC)");
    })();
  }
  await ventasSchemaReady;
}

let saasSystemsReady;
async function ensureSaasSystems() {
  if (!saasSystemsReady) {
    saasSystemsReady = (async () => {
      const systems = [
        ["correspondencia", "Correspondencia ZOW", "correspondencia-zow", "Recepcion, derivacion, seguimiento y archivo documental."],
        ["ventas_almacen", "Zow Ventas-Almacen", "zow-ventas-almacen", "Ventas, productos, stock, almacen e inventario."]
      ];
      for (const system of systems) {
        await pg.run(
          `INSERT INTO saas_systems (id, name, slug, description, status)
           VALUES (?, ?, ?, ?, 'active'::system_status)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             slug = excluded.slug,
             description = excluded.description,
             status = 'active'::system_status`,
          system
        );
      }
    })();
  }
  await saasSystemsReady;
}

async function buildNextSaleCode(companyId, date = new Date().toISOString(), client = pg) {
  const year = new Date(date).getFullYear();
  const prefix = `V-${year}`;
  const rows = await client.all("SELECT code FROM sales_orders WHERE company_id = ? AND code LIKE ?", [companyId, `${prefix}-%`]);
  const next = rows.reduce((max, row) => {
    const match = String(row.code || "").match(/(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;
  return `${prefix}-${String(next).padStart(5, "0")}`;
}

async function buildNextCashCode(companyId, date = new Date().toISOString(), client = pg) {
  const year = new Date(date).getFullYear();
  const prefix = `C-${year}`;
  const rows = await client.all("SELECT code FROM cash_closures WHERE company_id = ? AND code LIKE ?", [companyId, `${prefix}-%`]);
  const next = rows.reduce((max, row) => {
    const match = String(row.code || "").match(/(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;
  return `${prefix}-${String(next).padStart(5, "0")}`;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function sanitizeFileName(name) {
  return String(name || "archivo").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120);
}

async function buildNextDocumentCode(companyId, year, date = new Date().toISOString()) {
  const month = String(new Date(date).getMonth() + 1).padStart(2, "0");
  const prefix = `${month}-${year}`;
  const rows = await pg.all("SELECT code FROM documents WHERE company_id = ? AND code LIKE ?", [companyId, `${prefix}-%`]);
  const next = rows.reduce((max, row) => {
    const match = String(row.code || "").match(/(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;
  return `${prefix}-${String(next).padStart(4, "0")}`;
}
