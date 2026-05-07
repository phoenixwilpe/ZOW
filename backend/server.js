require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const QRCode = require("qrcode");
const path = require("node:path");
const fs = require("node:fs");
const { createHash, randomUUID } = require("node:crypto");
const { db, initDb } = require("./db");
const { signToken, requireAuth, requireRole, canSeeDocument } = require("./auth");
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

initDb();

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
const port = Number(process.env.PORT || 4174);
const uploadsDir = process.env.UPLOADS_DIR || (process.env.VERCEL ? "/tmp/zow-uploads" : path.join(__dirname, "..", "uploads"));
const showVentasSaas = true;
const enabledPanelSystemIds = ["correspondencia", "ventas_almacen"];
fs.mkdirSync(uploadsDir, { recursive: true });
const logosDir = path.join(uploadsDir, "logos");
fs.mkdirSync(logosDir, { recursive: true });

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 20 * 1024 * 1024, files: 20 },
  fileFilter: fileFilterForDocuments
});
const logoUpload = multer({
  dest: logosDir,
  limits: { fileSize: 600 * 1024, files: 1 },
  fileFilter: fileFilterForLogo
});

app.use(cors(corsOptions()));
applySecurity(app, express);
app.use(express.static(path.join(__dirname, "..")));

app.get("/api/public/qr", async (req, res) => {
  const text = String(req.query.text || "").trim();
  if (!text || text.length > 500) return res.status(400).json({ error: "Texto QR invalido" });
  const buffer = await QRCode.toBuffer(text, { type: "png", width: 220, margin: 1 });
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "no-store");
  res.send(buffer);
});

app.post("/api/leads", (req, res) => {
  const lead = readLeadPayload(req.body);
  if (!lead.name || !lead.company || !lead.phone) return res.status(400).json({ error: "Nombre, empresa y celular son obligatorios" });
  db.prepare(
    `INSERT INTO leads (id, name, company, phone, email, system_id, plan, message, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'nuevo', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  ).run(lead.id, lead.name, lead.company, lead.phone, lead.email, lead.systemId, lead.plan, lead.message);
  res.status(201).json({ ok: true });
});

app.post("/api/public/documents/lookup", (req, res) => {
  suspendExpiredCompanies();
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
  const documentItem = db
    .prepare(
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
       LIMIT 1`
    )
    .get(code, ci, todayIsoDate(), companySlug, companySlug);
  recordPublicLookup(req, code, ci, documentItem);
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

app.post("/api/auth/login", (req, res) => {
  suspendExpiredCompanies();
  const { username, password } = req.body;
  const normalizedUsername = normalizeUsername(username);
  const loginStatus = getLoginStatus(req, normalizedUsername);
  if (!loginStatus.allowed) {
    res.setHeader("Retry-After", String(loginStatus.retryAfterSeconds));
    return res.status(429).json({ error: "Demasiados intentos fallidos. Intenta nuevamente en unos minutos." });
  }
  const user =
    db.prepare("SELECT * FROM users WHERE lower(username) = lower(?) AND is_active = 1").get(normalizedUsername) ||
    (!normalizedUsername.includes("@")
      ? db.prepare("SELECT * FROM users WHERE lower(username) = lower(?) AND is_active = 1").get(`${normalizedUsername}@zow.com`)
      : null);

  if (!safePasswordCompare(password, user?.password_hash)) {
    recordLoginFailure(loginStatus.key);
    recordAuditEvent({
      req,
      action: "login_failed",
      entityType: "user",
      entityId: "",
      description: `Intento fallido para ${normalizedUsername}`,
      metadata: { username: normalizedUsername }
    });
    return res.status(401).json({ error: "Usuario o contrasena incorrectos" });
  }
  const company = db.prepare("SELECT status, billing_period, starts_at, ends_at FROM companies WHERE id = ?").get(user.company_id);
  if (!company || company.status !== "active") {
    return res.status(403).json({ error: "La empresa no esta activa o la membresia vencio. Contacte a ZOW." });
  }
  clearLoginFailures(loginStatus.key);

  const publicData = db
    .prepare(
      `SELECT users.id, users.company_id, users.name, users.username, users.role, users.unit_id, users.position, users.ci, users.phone, users.cash_register_number,
                units.name AS unit_name, companies.name AS company_name, companies.slug AS company_slug, companies.plan, companies.billing_period, companies.starts_at, companies.ends_at, companies.status AS company_status
         FROM users
         JOIN units ON units.id = users.unit_id
         JOIN companies ON companies.id = users.company_id
         WHERE users.id = ?`
    )
    .get(user.id);
  req.user = publicData;
  recordAuditEvent({ req, action: "login_success", entityType: "user", entityId: user.id, description: "Inicio de sesion correcto" });

  res.json({
    token: signToken(user),
    user: publicUser(publicData)
  });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/auth/systems", requireAuth, (req, res) => {
  if (req.user.role === "zow_owner") {
    const systems = db
      .prepare(`SELECT * FROM saas_systems WHERE status = 'active' AND id IN (${sqlPlaceholders(enabledPanelSystemIds)}) ORDER BY name`)
      .all(...enabledPanelSystemIds);
    return res.json({ systems });
  }

  const systems = db
    .prepare(
      `SELECT saas_systems.*, company_system_access.plan, company_system_access.status AS access_status
       FROM company_system_access
       JOIN saas_systems ON saas_systems.id = company_system_access.system_id
       WHERE company_system_access.company_id = ? AND company_system_access.status = 'active' AND saas_systems.status = 'active'
         AND saas_systems.id IN (${sqlPlaceholders(enabledPanelSystemIds)})
       ORDER BY saas_systems.name`
    )
    .all(req.user.company_id, ...enabledPanelSystemIds);
  res.json({ systems });
});

app.get("/api/units", requireAuth, (req, res) => {
  if (req.user.role === "zow_owner") return res.json({ units: [] });
  const units = db
    .prepare("SELECT id, company_id, name, code, parent_unit_id, level, is_active FROM units WHERE company_id = ? ORDER BY name")
    .all(req.user.company_id);
  res.json({ units });
});

app.get("/api/settings", requireAuth, (req, res) => {
  if (req.user.role === "zow_owner") return res.json({ settings: { companyName: "Panel ZOW SaaS" } });
  res.json({ settings: mapSettings(loadSettings(req.user.company_id)) });
});

app.patch("/api/settings", requireAuth, requireRole("admin"), (req, res) => {
  const companyName = String(req.body.companyName || "").trim();
  if (!companyName) return res.status(400).json({ error: "Nombre de empresa obligatorio" });
  const settings = {
    companyName,
    taxId: String(req.body.taxId || "").trim(),
    phone: String(req.body.phone || "").trim(),
    address: String(req.body.address || "").trim()
  };

  db.prepare(
    `INSERT INTO organization_settings (id, company_id, company_name, tax_id, phone, address, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET company_name = excluded.company_name, tax_id = excluded.tax_id, phone = excluded.phone, address = excluded.address, updated_at = excluded.updated_at`
  ).run(req.user.company_id, req.user.company_id, settings.companyName, settings.taxId, settings.phone, settings.address, new Date().toISOString());

  recordAuditEvent({ req, action: "settings_update", entityType: "settings", entityId: req.user.company_id, description: "Actualizo datos de empresa y membrete" });
  res.json({ settings: mapSettings(loadSettings(req.user.company_id)) });
});

app.post("/api/settings/logo", requireAuth, requireRole("admin"), logoUpload.single("logo"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Selecciona un logo PNG" });
  const now = new Date().toISOString();
  const relativePath = path.relative(path.join(__dirname, ".."), req.file.path).replace(/\\/g, "/");
  db.prepare(
    `INSERT INTO organization_settings (id, company_id, company_name, logo_bucket, logo_path, logo_name, logo_mime, logo_updated_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET logo_bucket = excluded.logo_bucket, logo_path = excluded.logo_path, logo_name = excluded.logo_name, logo_mime = excluded.logo_mime, logo_updated_at = excluded.logo_updated_at, updated_at = excluded.updated_at`
  ).run(
    req.user.company_id,
    req.user.company_id,
    req.user.company_name || "Empresa sin configurar",
    "local",
    relativePath,
    req.file.originalname || "logo.png",
    req.file.mimetype || "image/png",
    now,
    now
  );
  recordAuditEvent({ req, action: "logo_update", entityType: "settings", entityId: req.user.company_id, description: "Actualizo logo institucional" });
  res.json({ settings: mapSettings(loadSettings(req.user.company_id)) });
});

app.post("/api/units", requireAuth, requireRole("admin"), (req, res) => {
  const unit = {
    id: randomUUID(),
    name: String(req.body.name || "").trim(),
    code: String(req.body.code || "").trim().toUpperCase(),
    parentUnitId: String(req.body.parentUnitId || ""),
    level: String(req.body.level || "secundaria")
  };

  if (!unit.name || !unit.code) {
    return res.status(400).json({ error: "Nombre y codigo son obligatorios" });
  }
  const parent = unit.parentUnitId ? db.prepare("SELECT id FROM units WHERE id = ? AND company_id = ?").get(unit.parentUnitId, req.user.company_id) : null;
  if (unit.parentUnitId && !parent) return res.status(400).json({ error: "El area padre no pertenece a esta empresa" });

  db.prepare("INSERT INTO units (id, company_id, name, code, parent_unit_id, level) VALUES (?, ?, ?, ?, ?, ?)").run(
    unit.id,
    req.user.company_id,
    unit.name,
    unit.code,
    unit.parentUnitId,
    unit.level
  );
  recordAuditEvent({ req, action: "unit_create", entityType: "unit", entityId: unit.id, description: `Creo area ${unit.name}` });
  res.status(201).json({ unit });
});

app.get("/api/users", requireAuth, requireRole("admin"), (req, res) => {
  const users = db
    .prepare(
      `SELECT users.id, users.name, users.username, users.role, users.unit_id, users.position, users.ci, users.phone, users.cash_register_number,
              users.is_active, users.is_protected, units.name AS unit_name
       FROM users
       JOIN units ON units.id = users.unit_id
       WHERE users.company_id = ?
       ORDER BY users.name`
    )
    .all(req.user.company_id);
  res.json({ users });
});

app.post("/api/users", requireAuth, requireRole("admin"), (req, res) => {
  const password = String(req.body.password || "").trim();
  const user = {
    id: randomUUID(),
    name: String(req.body.name || "").trim(),
    username: normalizeUsername(req.body.username),
    role: String(req.body.role || "funcionario"),
    unitId: String(req.body.unitId || "").trim(),
    position: String(req.body.position || "").trim(),
    ci: String(req.body.ci || "").trim(),
    phone: String(req.body.phone || "").trim(),
    cashRegisterNumber: clampNumber(req.body.cashRegisterNumber, 0, mapSettings(loadSettings(req.user.company_id)).cashRegisterCount || 1, 0)
  };

  if (!user.name || !user.username || !password || !user.unitId) {
    return res.status(400).json({ error: "Faltan datos obligatorios" });
  }
  if (!USER_ROLES.has(user.role)) return res.status(400).json({ error: "Rol invalido" });
  if (user.role === "admin") return res.status(403).json({ error: "Solo ZOW puede crear el encargado de sistema inicial" });
  const passwordError = validatePasswordStrength(password);
  if (passwordError) return res.status(400).json({ error: passwordError });
  const duplicate = db.prepare("SELECT id FROM users WHERE lower(username) = lower(?)").get(user.username);
  if (duplicate) return res.status(400).json({ error: "Ese usuario ya existe" });
  const unit = db.prepare("SELECT id FROM units WHERE id = ? AND company_id = ?").get(user.unitId, req.user.company_id);
  if (!unit) return res.status(400).json({ error: "La unidad no pertenece a esta empresa" });

  const passwordHash = bcrypt.hashSync(password, 12);
  db.prepare(
    `INSERT INTO users (id, company_id, name, username, password_hash, role, unit_id, position, ci, phone, cash_register_number)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(user.id, req.user.company_id, user.name, user.username, passwordHash, user.role, user.unitId, user.position, user.ci, user.phone, user.cashRegisterNumber);

  recordAuditEvent({ req, action: "user_create", entityType: "user", entityId: user.id, description: `Creo usuario ${user.username}`, metadata: { role: user.role } });
  res.status(201).json({ user });
});

app.patch("/api/users/:id", requireAuth, requireRole("admin"), (req, res) => {
  const existing = db.prepare("SELECT id, username, role, unit_id, cash_register_number, is_protected FROM users WHERE id = ? AND company_id = ?").get(req.params.id, req.user.company_id);
  if (!existing) return res.status(404).json({ error: "Usuario no encontrado" });

  const user = {
    name: String(req.body.name || "").trim(),
    username: normalizeUsername(req.body.username),
    role: String(req.body.role || "funcionario"),
    unitId: String(req.body.unitId || "").trim(),
    position: String(req.body.position || "").trim(),
    ci: String(req.body.ci || "").trim(),
    phone: String(req.body.phone || "").trim(),
    password: String(req.body.password || "").trim(),
    cashRegisterNumber: clampNumber(req.body.cashRegisterNumber, 0, mapSettings(loadSettings(req.user.company_id)).cashRegisterCount || 1, 0)
  };

  if (!user.name || !user.username || !user.unitId) {
    return res.status(400).json({ error: "Nombre, usuario y unidad son obligatorios" });
  }
  if (!USER_ROLES.has(user.role)) return res.status(400).json({ error: "Rol invalido" });
  if (!existing.is_protected && user.role === "admin") {
    return res.status(403).json({ error: "No se puede asignar el rol Encargado de sistema desde usuarios" });
  }

  const duplicate = db.prepare("SELECT id FROM users WHERE lower(username) = lower(?) AND id <> ?").get(user.username, existing.id);
  if (duplicate) return res.status(400).json({ error: "Ese usuario ya existe" });
  const unit = db.prepare("SELECT id FROM units WHERE id = ? AND company_id = ?").get(user.unitId, req.user.company_id);
  if (!existing.is_protected && !unit) return res.status(400).json({ error: "La unidad no pertenece a esta empresa" });

  const finalRole = existing.is_protected ? existing.role : user.role;
  const finalUnit = existing.is_protected ? existing.unit_id : user.unitId;
  const finalCashRegister = existing.is_protected ? Number(existing.cash_register_number || 0) : user.cashRegisterNumber;

  db.prepare(
    `UPDATE users
     SET name = ?, username = ?, role = ?, unit_id = ?, position = ?, ci = ?, phone = ?, cash_register_number = ?
     WHERE id = ?`
  ).run(user.name, user.username, finalRole, finalUnit, user.position, user.ci, user.phone, finalCashRegister, existing.id);

  if (user.password) {
    const passwordError = validatePasswordStrength(user.password);
    if (passwordError) return res.status(400).json({ error: passwordError });
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(bcrypt.hashSync(user.password, 12), existing.id);
  }

  recordAuditEvent({
    req,
    action: "user_update",
    entityType: "user",
    entityId: existing.id,
    description: `Actualizo usuario ${user.username}`,
    metadata: { role: finalRole, passwordChanged: Boolean(user.password) }
  });
  res.json({ user: db.prepare("SELECT id, company_id, name, username, role, unit_id, position, ci, phone, cash_register_number, is_active, is_protected FROM users WHERE id = ?").get(existing.id) });
});

app.patch("/api/users/:id/status", requireAuth, requireRole("admin"), (req, res) => {
  const user = db.prepare("SELECT id, username, is_protected FROM users WHERE id = ? AND company_id = ?").get(req.params.id, req.user.company_id);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
  if (user.is_protected) return res.status(400).json({ error: "No se puede desactivar un usuario protegido" });

  const active = req.body.active ? 1 : 0;
  db.prepare("UPDATE users SET is_active = ? WHERE id = ?").run(active, user.id);
  recordAuditEvent({
    req,
    action: "user_status",
    entityType: "user",
    entityId: user.id,
    description: `${active ? "Activo" : "Desactivo"} usuario ${user.username}`
  });
  res.json({ ok: true });
});

app.get("/api/documents", requireAuth, (req, res) => {
  if (req.user.role === "zow_owner") return res.json({ documents: [] });
  const documents = db
    .prepare(
      `SELECT documents.*,
              COALESCE((SELECT COUNT(*) FROM document_files WHERE document_files.company_id = documents.company_id AND document_files.document_id = documents.id), 0) AS digital_file_count,
              COALESCE((SELECT GROUP_CONCAT(original_name, ', ') FROM document_files WHERE document_files.company_id = documents.company_id AND document_files.document_id = documents.id), documents.digital_file_name) AS digital_file_names
       FROM documents
       WHERE documents.company_id = ?
       ORDER BY documents.created_at DESC`
    )
    .all(req.user.company_id)
    .filter((doc) => canSeeDocument(req.user, doc));
  res.json({ documents });
});

app.get("/api/notifications", requireAuth, (req, res) => {
  if (["admin", "recepcion_principal"].includes(req.user.role)) {
    return res.json({ notifications: [], pendingCount: 0 });
  }

  const notifications = db
    .prepare(
      `SELECT documents.id, documents.code, documents.subject, documents.reference, documents.applicant_name,
              documents.status, document_recipients.received_at
       FROM document_recipients
       JOIN documents ON documents.id = document_recipients.document_id
       WHERE document_recipients.company_id = ? AND documents.company_id = ? AND document_recipients.unit_id = ? AND document_recipients.status = 'Pendiente'
       ORDER BY document_recipients.received_at DESC`
    )
    .all(req.user.company_id, req.user.company_id, req.user.unit_id);

  res.json({ notifications, pendingCount: notifications.length });
});

const documentUpload = upload.fields([
  { name: "digitalFile", maxCount: 1 },
  { name: "digitalFiles", maxCount: 20 }
]);

app.post("/api/documents", requireAuth, requireRole("recepcion_principal", "funcionario"), documentUpload, (req, res) => {
  const id = randomUUID();
  const now = new Date().toISOString();
  const direction = req.body.direction === "Saliente" ? "Saliente" : "Entrante";
  if (direction === "Entrante" && !["admin", "recepcion_principal"].includes(req.user.role)) {
    return res.status(403).json({ error: "Solo Recepcion puede registrar documentacion entrante" });
  }

  const receptionUnitId = db.prepare("SELECT id FROM units WHERE company_id = ? AND level = 'principal' AND code IN ('VU', 'REC') ORDER BY code DESC").get(req.user.company_id)?.id || req.user.unit_id;
  const currentUnitId = direction === "Entrante" ? receptionUnitId : req.user.unit_id;
  const uploadedFiles = getUploadedFiles(req);
  const primaryFile = uploadedFiles[0];
  const hasFile = uploadedFiles.length > 0;

  const doc = {
    id,
    direction,
    year: String(req.body.year || new Date().getFullYear()),
    type: String(req.body.type || "Oficio"),
    code: buildNextDocumentCode(req.user.company_id, String(req.body.year || new Date().getFullYear()), now),
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

  db.prepare(
    `INSERT INTO documents (
      id, direction, year, type, code, internal_number, reference, subject, sender, receiver,
      company_id, source_unit_id, target_unit_id, current_unit_id, created_by_unit_id, owner_name, priority,
      status, due_date, has_digital_file, digital_file_name, digital_file_path, digital_file_size,
      digital_attached_at, physical_received, created_by, created_at, updated_at,
      applicant_name, applicant_ci, applicant_phone, sheet_count, received_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
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
    hasFile ? 1 : 0,
    primaryFile?.originalname || "",
    primaryFile?.filename || "",
    primaryFile?.size || 0,
    hasFile ? now : "",
    direction === "Entrante" ? 1 : 0,
    req.user.id,
    now,
    now,
    doc.applicantName,
    doc.applicantCi,
    doc.applicantPhone,
    doc.sheetCount,
    now
  );

  attachUploadedFiles({
    files: uploadedFiles,
    companyId: req.user.company_id,
    documentId: doc.id,
    userId: req.user.id,
    uploadedAt: now
  });

  db.prepare(
    `INSERT INTO movements (id, company_id, document_id, from_unit_id, to_unit_id, instruction_type, due_days, comment, status, created_by, derived_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    req.user.company_id,
    doc.id,
    null,
    doc.currentUnitId,
    "Registro inicial",
    0,
    direction === "Entrante"
      ? `Documento registrado en Recepcion Principal. Adjuntos digitales: ${uploadedFiles.length || 0}.`
      : `Documento saliente registrado. Adjuntos digitales: ${uploadedFiles.length || 0}.`,
    doc.status,
    req.user.id,
    now
  );

  db.prepare(
    `INSERT OR IGNORE INTO document_recipients (company_id, document_id, unit_id, status, received_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(req.user.company_id, doc.id, doc.currentUnitId, doc.status, now);

  recordAuditEvent({ req, action: "document_create", entityType: "document", entityId: doc.id, description: `Registro ${doc.code}`, metadata: { direction: doc.direction } });
  res.status(201).json({ document: getDocumentById(id, req.user.company_id) });
});

app.patch("/api/documents/:id/status", requireAuth, (req, res) => {
  const doc = db.prepare("SELECT * FROM documents WHERE id = ? AND company_id = ?").get(req.params.id, req.user.company_id);
  if (!doc) return res.status(404).json({ error: "Documento no encontrado" });
  if (!canSeeDocument(req.user, doc)) return res.status(403).json({ error: "Permiso insuficiente" });

  const allowed = ["En revision", "Atendido", "Archivado", "Recibido", "Vencido"];
  const status = String(req.body.status || "");
  if (!allowed.includes(status)) return res.status(400).json({ error: "Estado invalido" });
  if (req.user.role === "recepcion_principal" && ["Atendido", "Archivado"].includes(status)) {
    return res.status(403).json({ error: "Recepcion principal no puede atender o archivar documentacion de areas" });
  }

  const now = new Date().toISOString();
  db.prepare("UPDATE documents SET status = ?, updated_at = ? WHERE id = ?").run(status, now, doc.id);
  db.prepare("UPDATE document_recipients SET status = ? WHERE document_id = ? AND unit_id = ?").run(status, doc.id, req.user.unit_id);
  db.prepare(
    `INSERT INTO movements (id, company_id, document_id, from_unit_id, to_unit_id, instruction_type, due_days, comment, status, created_by, derived_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    req.user.company_id,
    doc.id,
    doc.current_unit_id,
    doc.current_unit_id,
    "Cambio de estado",
    0,
    String(req.body.comment || `Estado actualizado a ${status}.`),
    status,
    req.user.id,
    now
  );

  recordAuditEvent({ req, action: "document_status", entityType: "document", entityId: doc.id, description: `Cambio estado a ${status}` });
  res.json({ document: db.prepare("SELECT * FROM documents WHERE id = ? AND company_id = ?").get(doc.id, req.user.company_id) });
});

app.patch("/api/documents/:id/physical-received", requireAuth, (req, res) => {
  const doc = db.prepare("SELECT * FROM documents WHERE id = ? AND company_id = ?").get(req.params.id, req.user.company_id);
  if (!doc) return res.status(404).json({ error: "Documento no encontrado" });
  if (!canSeeDocument(req.user, doc)) return res.status(403).json({ error: "Permiso insuficiente" });

  const now = new Date().toISOString();
  const status = doc.status === "Reservado" ? "Recibido" : doc.status;
  db.prepare("UPDATE documents SET physical_received = 1, status = ?, updated_at = ? WHERE id = ?").run(status, now, doc.id);
  db.prepare(
    `INSERT INTO movements (id, company_id, document_id, from_unit_id, to_unit_id, instruction_type, due_days, comment, status, created_by, derived_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    req.user.company_id,
    doc.id,
    doc.current_unit_id,
    doc.current_unit_id,
    "Recepcion fisica",
    0,
    "Se confirmo la recepcion fisica del documento.",
    status,
    req.user.id,
    now
  );

  recordAuditEvent({ req, action: "physical_received", entityType: "document", entityId: doc.id, description: "Marco recepcion fisica" });
  res.json({ document: db.prepare("SELECT * FROM documents WHERE id = ? AND company_id = ?").get(doc.id, req.user.company_id) });
});

app.post("/api/documents/:id/derive", requireAuth, requireRole("recepcion_principal", "recepcion_secundaria", "funcionario", "supervisor"), (req, res) => {
  const doc = db.prepare("SELECT * FROM documents WHERE id = ? AND company_id = ?").get(req.params.id, req.user.company_id);
  if (!doc) return res.status(404).json({ error: "Documento no encontrado" });
  if (!canSeeDocument(req.user, doc)) return res.status(403).json({ error: "Permiso insuficiente" });

  const requestedUnitIds = Array.isArray(req.body.toUnitIds)
    ? req.body.toUnitIds
    : [req.body.toUnitId].filter(Boolean);
  const uniqueUnitIds = [...new Set(requestedUnitIds.map((unitId) => String(unitId || "").trim()).filter(Boolean))];
  if (!uniqueUnitIds.length) return res.status(400).json({ error: "Debe seleccionar al menos una unidad destino" });

  const units = uniqueUnitIds.map((unitId) => db.prepare("SELECT id, name FROM units WHERE id = ? AND company_id = ?").get(unitId, req.user.company_id));
  if (units.some((unit) => !unit)) return res.status(400).json({ error: "Una o mas unidades destino son invalidas" });

  const now = new Date().toISOString();
  const insertMovement = db.prepare(
    `INSERT INTO movements (id, company_id, document_id, from_unit_id, to_unit_id, instruction_type, due_days, comment, status, created_by, derived_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const upsertRecipient = db.prepare(
    `INSERT INTO document_recipients (company_id, document_id, unit_id, status, received_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(document_id, unit_id) DO UPDATE SET status = excluded.status, received_at = excluded.received_at`
  );

  units.forEach((unit) => {
    insertMovement.run(
      randomUUID(),
      req.user.company_id,
      doc.id,
      req.user.unit_id,
      unit.id,
      String(req.body.instructionType || "Para conocimiento"),
      Number(req.body.dueDays || 0),
      buildDerivationComment(unit.name, req.body.comment),
      "Derivado",
      req.user.id,
      now
    );
    upsertRecipient.run(req.user.company_id, doc.id, unit.id, "Pendiente", now);
  });

  db.prepare(
    `UPDATE documents SET current_unit_id = ?, target_unit_id = ?, owner_name = ?, status = ?, updated_at = ?
     WHERE id = ?`
  ).run(units[0].id, units[0].id, units.length === 1 ? units[0].name : `${units.length} unidades derivadas`, "Derivado", now, doc.id);

  recordAuditEvent({ req, action: "document_derive", entityType: "document", entityId: doc.id, description: `Derivo a ${units.length} unidad(es)`, metadata: { units: units.map((unit) => unit.name) } });
  res.json({ document: getDocumentById(doc.id, req.user.company_id) });
});

app.get("/api/documents/:id/digital-file", requireAuth, (req, res) => {
  const doc = db.prepare("SELECT * FROM documents WHERE id = ? AND company_id = ?").get(req.params.id, req.user.company_id);
  if (!doc) return res.status(404).json({ error: "Documento no encontrado" });
  if (!canSeeDocument(req.user, doc)) return res.status(403).json({ error: "Permiso insuficiente" });
  if (!doc.digital_file_path) return res.status(404).json({ error: "El documento no tiene archivo digital" });

  const filePath = path.join(uploadsDir, doc.digital_file_path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Archivo no encontrado" });

  res.download(filePath, doc.digital_file_name || `${doc.code}.pdf`);
});

app.get("/api/documents/:id/files", requireAuth, (req, res) => {
  const doc = db.prepare("SELECT * FROM documents WHERE id = ? AND company_id = ?").get(req.params.id, req.user.company_id);
  if (!doc) return res.status(404).json({ error: "Documento no encontrado" });
  if (!canSeeDocument(req.user, doc)) return res.status(403).json({ error: "Permiso insuficiente" });

  const files = db
    .prepare("SELECT id, original_name, size, mime_type, uploaded_at FROM document_files WHERE company_id = ? AND document_id = ? ORDER BY uploaded_at ASC")
    .all(req.user.company_id, doc.id);
  res.json({ files });
});

app.post("/api/documents/:id/digital-file", requireAuth, documentUpload, (req, res) => {
  const doc = db.prepare("SELECT * FROM documents WHERE id = ? AND company_id = ?").get(req.params.id, req.user.company_id);
  if (!doc) return res.status(404).json({ error: "Documento no encontrado" });
  if (!canSeeDocument(req.user, doc)) return res.status(403).json({ error: "Permiso insuficiente" });
  const uploadedFiles = getUploadedFiles(req);
  const primaryFile = uploadedFiles[0];
  if (!uploadedFiles.length) return res.status(400).json({ error: "Archivo requerido" });

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE documents
     SET has_digital_file = 1, digital_file_name = ?, digital_file_path = ?, digital_file_size = ?,
         digital_attached_at = ?, updated_at = ?
     WHERE id = ?`
  ).run(primaryFile.originalname, primaryFile.filename, primaryFile.size, now, now, doc.id);

  attachUploadedFiles({
    files: uploadedFiles,
    companyId: req.user.company_id,
    documentId: doc.id,
    userId: req.user.id,
    uploadedAt: now
  });

  db.prepare(
    `INSERT INTO movements (id, company_id, document_id, from_unit_id, to_unit_id, instruction_type, due_days, comment, status, created_by, derived_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    req.user.company_id,
    doc.id,
    req.user.unit_id,
    doc.current_unit_id,
    "Actualizacion de documento digital",
    0,
    String(req.body.comment || `Archivos adjuntados: ${uploadedFiles.map((file) => file.originalname).join(", ")}`),
    doc.status,
    req.user.id,
    now
  );

  recordAuditEvent({ req, action: "document_upload", entityType: "document", entityId: doc.id, description: `Adjunto ${uploadedFiles.length} archivo(s)` });
  res.json({ document: getDocumentById(doc.id, req.user.company_id) });
});

app.get("/api/documents/:id/movements", requireAuth, (req, res) => {
  const doc = db.prepare("SELECT * FROM documents WHERE id = ? AND company_id = ?").get(req.params.id, req.user.company_id);
  if (!doc) return res.status(404).json({ error: "Documento no encontrado" });
  if (!canSeeDocument(req.user, doc)) return res.status(403).json({ error: "Permiso insuficiente" });

  const movements = db
    .prepare(
      `SELECT movements.*, from_units.name AS from_unit_name, to_units.name AS to_unit_name, users.name AS created_by_name
       FROM movements
       LEFT JOIN units AS from_units ON from_units.id = movements.from_unit_id
       LEFT JOIN units AS to_units ON to_units.id = movements.to_unit_id
       LEFT JOIN users ON users.id = movements.created_by
       WHERE movements.company_id = ? AND movements.document_id = ?
       ORDER BY movements.derived_at DESC`
    )
    .all(req.user.company_id, doc.id);
  res.json({ movements });
});

app.patch("/api/documents/:id/seen", requireAuth, (req, res) => {
  const doc = db.prepare("SELECT * FROM documents WHERE id = ? AND company_id = ?").get(req.params.id, req.user.company_id);
  if (!doc) return res.status(404).json({ error: "Documento no encontrado" });
  if (!canSeeDocument(req.user, doc)) return res.status(403).json({ error: "Permiso insuficiente" });
  if (["admin", "recepcion_principal"].includes(req.user.role)) return res.json({ ok: true });

  db.prepare("UPDATE document_recipients SET status = 'En revision' WHERE company_id = ? AND document_id = ? AND unit_id = ? AND status = 'Pendiente'").run(
    req.user.company_id,
    doc.id,
    req.user.unit_id
  );
  res.json({ ok: true });
});

app.get("/api/companies", requireAuth, requireRole("zow_owner"), (req, res) => {
  suspendExpiredCompanies();
  const companies = db
    .prepare(
      `SELECT companies.*,
              COUNT(DISTINCT users.id) AS user_count,
              COUNT(DISTINCT units.id) AS unit_count,
              COUNT(DISTINCT documents.id) AS document_count,
              COALESCE(GROUP_CONCAT(DISTINCT saas_systems.name), '') AS systems,
              admin_user.id AS admin_user_id,
              admin_user.name AS admin_name,
              admin_user.username AS admin_username
       FROM companies
       LEFT JOIN users ON users.company_id = companies.id
       LEFT JOIN units ON units.company_id = companies.id
       LEFT JOIN documents ON documents.company_id = companies.id
       LEFT JOIN company_system_access ON company_system_access.company_id = companies.id AND company_system_access.status = 'active'
       LEFT JOIN saas_systems ON saas_systems.id = company_system_access.system_id
         AND saas_systems.id IN (${sqlPlaceholders(enabledPanelSystemIds)})
       LEFT JOIN users AS admin_user ON admin_user.id = (
         SELECT id
         FROM users AS company_admin
         WHERE company_admin.company_id = companies.id AND company_admin.role = 'admin'
         ORDER BY company_admin.is_protected DESC, company_admin.created_at ASC
         LIMIT 1
       )
       WHERE companies.id NOT IN ('zow-internal', 'company-default')
         AND companies.slug NOT LIKE 'cliente-prueba-%'
         AND (? = 1 OR NOT EXISTS (
           SELECT 1
           FROM company_system_access hidden_access
           WHERE hidden_access.company_id = companies.id
             AND hidden_access.system_id = 'ventas_almacen'
             AND hidden_access.status = 'active'
         ))
       GROUP BY companies.id
       ORDER BY companies.created_at DESC`
    )
    .all(...enabledPanelSystemIds, showVentasSaas ? 1 : 0);
  res.json({ companies });
});

app.get("/api/public-lookups", requireAuth, requireRole("zow_owner"), (req, res) => {
  const lookups = db
    .prepare(
      `SELECT public_lookup_audit.id, public_lookup_audit.code, public_lookup_audit.ip_address,
              public_lookup_audit.user_agent, public_lookup_audit.found, public_lookup_audit.created_at,
              companies.name AS company_name, documents.applicant_name
       FROM public_lookup_audit
       LEFT JOIN companies ON companies.id = public_lookup_audit.company_id
       LEFT JOIN documents ON documents.id = public_lookup_audit.document_id
       ORDER BY public_lookup_audit.created_at DESC
       LIMIT 80`
    )
    .all();
  res.json({ lookups });
});

app.get("/api/system-health", requireAuth, requireRole("zow_owner"), (req, res) => {
  const companies = db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active, SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) AS suspended FROM companies WHERE id <> 'zow-internal'").get();
  const users = db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active FROM users").get();
  const documents = db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'Archivado' THEN 1 ELSE 0 END) AS archived FROM documents").get();
  const audit = db.prepare("SELECT COUNT(*) AS total, MAX(created_at) AS latest FROM audit_events").get();
  const publicLookups = db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN found = 0 THEN 1 ELSE 0 END) AS failed FROM public_lookup_audit").get();
  res.json({
    ok: true,
    database: "sqlite",
    checkedAt: new Date().toISOString(),
    dbTime: new Date().toISOString(),
    companies,
    users,
    documents,
    audit,
    publicLookups
  });
});

app.get("/api/leads", requireAuth, requireRole("zow_owner"), (req, res) => {
  const leads = db.prepare("SELECT * FROM leads ORDER BY created_at DESC LIMIT 200").all();
  const historyStmt = db.prepare("SELECT * FROM lead_history WHERE lead_id = ? ORDER BY created_at DESC");
  leads.forEach((lead) => {
    lead.history = historyStmt.all(lead.id);
  });
  res.json({ leads });
});

app.patch("/api/leads/:id/status", requireAuth, requireRole("zow_owner"), (req, res) => {
  const status = String(req.body.status || "").trim();
  if (!["nuevo", "contactado", "demo_agendada", "propuesta_enviada", "convertido", "descartado"].includes(status)) return res.status(400).json({ error: "Estado invalido" });
  const lead = db.prepare("SELECT id, company FROM leads WHERE id = ?").get(req.params.id);
  if (!lead) return res.status(404).json({ error: "Lead no encontrado" });
  db.prepare("UPDATE leads SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(status, lead.id);
  recordLeadHistory({ req, leadId: lead.id, status, description: `Cambio de estado a ${status}` });
  recordAuditEvent({ req, action: "lead_status", entityType: "lead", entityId: lead.id, description: `Cambio lead ${lead.company} a ${status}` });
  res.json({ ok: true });
});

app.patch("/api/leads/:id", requireAuth, requireRole("zow_owner"), (req, res) => {
  const status = String(req.body.status || "").trim();
  if (status && !["nuevo", "contactado", "demo_agendada", "propuesta_enviada", "convertido", "descartado"].includes(status)) return res.status(400).json({ error: "Estado invalido" });
  const lead = db.prepare("SELECT id, company FROM leads WHERE id = ?").get(req.params.id);
  if (!lead) return res.status(404).json({ error: "Lead no encontrado" });
  const notes = String(req.body.notes || "").trim().slice(0, 1200);
  const nextAction = String(req.body.nextAction || req.body.next_action || "").trim().slice(0, 220);
  const nextActionAt = normalizeDateInput(req.body.nextActionAt || req.body.next_action_at);
  const priority = normalizeLeadPriority(req.body.priority || "media");
  const current = db.prepare("SELECT status, notes, next_action, next_action_at, priority FROM leads WHERE id = ?").get(lead.id);
  db.prepare(
    `UPDATE leads
     SET status = COALESCE(NULLIF(?, ''), status),
         priority = ?,
         notes = ?,
         next_action = ?,
         next_action_at = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(status, priority, notes, nextAction, nextActionAt, lead.id);
  recordLeadHistory({
    req,
    leadId: lead.id,
    status: status || current.status,
    priority,
    nextAction,
    nextActionAt,
    notes,
    description: buildLeadHistoryDescription(current, { status, priority, notes, nextAction, nextActionAt })
  });
  recordAuditEvent({ req, action: "lead_update", entityType: "lead", entityId: lead.id, description: `Actualizo seguimiento de lead ${lead.company}` });
  const updatedLead = db.prepare("SELECT * FROM leads WHERE id = ?").get(lead.id);
  updatedLead.history = db.prepare("SELECT * FROM lead_history WHERE lead_id = ? ORDER BY created_at DESC").all(lead.id);
  res.json({ lead: updatedLead });
});

app.get("/api/audit", requireAuth, requireRole("admin", "zow_owner"), (req, res) => {
  const params = [];
  const companyFilter = req.user.role === "zow_owner" ? "" : "WHERE audit_events.company_id = ?";
  if (companyFilter) params.push(req.user.company_id);
  const events = db
    .prepare(
      `SELECT audit_events.*, companies.name AS company_name
       FROM audit_events
       LEFT JOIN companies ON companies.id = audit_events.company_id
       ${companyFilter}
       ORDER BY audit_events.created_at DESC
       LIMIT 120`
    )
    .all(...params);
  res.json({ events });
});

app.post("/api/companies", requireAuth, requireRole("zow_owner"), (req, res) => {
  const now = new Date().toISOString();
  const membership = normalizeMembership(req.body);
  const company = {
    id: randomUUID(),
    name: String(req.body.name || "").trim(),
    slug: slugify(req.body.slug || req.body.name || ""),
    plan: String(req.body.plan || "basico").trim(),
    billingPeriod: membership.billingPeriod,
    status: String(req.body.status || "active").trim(),
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
    sourceLeadId: String(req.body.sourceLeadId || "").trim()
  };
  const requestedSystems = Array.isArray(req.body.systems) && req.body.systems.length ? req.body.systems : ["correspondencia"];

  if (!company.name || !company.slug || !company.adminUsername || !company.adminPassword) {
    return res.status(400).json({ error: "Empresa, usuario y contrasena inicial son obligatorios" });
  }
  const passwordError = validatePasswordStrength(company.adminPassword);
  if (passwordError) return res.status(400).json({ error: passwordError });

  const duplicateCompany = db.prepare("SELECT id FROM companies WHERE slug = ?").get(company.slug);
  if (duplicateCompany) return res.status(400).json({ error: "Ese identificador de empresa ya existe" });
  const duplicateUser = db.prepare("SELECT id FROM users WHERE lower(username) = lower(?)").get(company.adminUsername);
  if (duplicateUser) return res.status(400).json({ error: "Ese usuario inicial ya existe" });

  const adminUnitId = randomUUID();
  const receptionUnitId = randomUUID();
  const adminUserId = randomUUID();

  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO companies (
        id, name, slug, plan, billing_period, status, max_users, max_units, storage_mb, contact_name, contact_email,
        contact_phone, starts_at, ends_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      company.id,
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
      now
    );
    db.prepare("INSERT INTO organization_settings (id, company_id, company_name, updated_at) VALUES (?, ?, ?, ?)").run(
      company.id,
      company.id,
      company.name,
      now
    );
    db.prepare("INSERT INTO units (id, company_id, name, code, parent_unit_id, level) VALUES (?, ?, ?, ?, ?, ?)").run(
      adminUnitId,
      company.id,
      "Administracion del Sistema",
      "ADM",
      "",
      "principal"
    );
    db.prepare("INSERT INTO units (id, company_id, name, code, parent_unit_id, level) VALUES (?, ?, ?, ?, ?, ?)").run(
      receptionUnitId,
      company.id,
      "Recepcion Principal",
      "REC",
      "",
      "principal"
    );
    db.prepare(
      `INSERT INTO users (id, company_id, name, username, password_hash, role, unit_id, position, is_protected, ci, phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      adminUserId,
      company.id,
      company.adminName,
      company.adminUsername,
      bcrypt.hashSync(company.adminPassword, 12),
      "admin",
      adminUnitId,
      "Encargado de sistema",
      1,
      "",
      company.contactPhone
    );
    const insertAccess = db.prepare(
      `INSERT OR IGNORE INTO company_system_access (company_id, system_id, status, plan, starts_at, ends_at, updated_at)
       VALUES (?, ?, 'active', ?, ?, ?, ?)`
    );
    requestedSystems.forEach((systemId) => {
      const system = db.prepare("SELECT id FROM saas_systems WHERE id = ?").get(systemId);
      if (system) insertAccess.run(company.id, system.id, company.plan, company.startsAt, company.endsAt, now);
    });
    if (company.sourceLeadId) {
      db.prepare("UPDATE leads SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run("convertido", company.sourceLeadId);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    return res.status(400).json({ error: error.message || "No se pudo crear la empresa" });
  }

  recordAuditEvent({ req, action: "company_create", entityType: "company", entityId: company.id, description: `Creo empresa ${company.name}` });
  if (company.sourceLeadId) {
    recordAuditEvent({ req, action: "lead_convert", entityType: "lead", entityId: company.sourceLeadId, description: `Convirtio lead en empresa ${company.name}` });
  }
  res.status(201).json({
    company: db.prepare("SELECT * FROM companies WHERE id = ?").get(company.id),
    adminUser: { id: adminUserId, username: company.adminUsername, name: company.adminName }
  });
});

app.patch("/api/companies/:id", requireAuth, requireRole("zow_owner"), (req, res) => {
  const existing = db.prepare("SELECT id FROM companies WHERE id = ? AND id <> 'zow-internal'").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Empresa no encontrada" });

  const now = new Date().toISOString();
  const membership = normalizeMembership(req.body);
  const company = {
    name: String(req.body.name || "").trim(),
    slug: slugify(req.body.slug || req.body.name || ""),
    plan: String(req.body.plan || "basico").trim(),
    billingPeriod: membership.billingPeriod,
    status: String(req.body.status || "active").trim(),
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
  const duplicateCompany = db.prepare("SELECT id FROM companies WHERE slug = ? AND id <> ?").get(company.slug, existing.id);
  if (duplicateCompany) return res.status(400).json({ error: "Ese identificador de empresa ya existe" });
  const adminUser =
    (company.adminUserId && db.prepare("SELECT id FROM users WHERE id = ? AND company_id = ? AND role = 'admin'").get(company.adminUserId, existing.id)) ||
    db.prepare("SELECT id FROM users WHERE company_id = ? AND role = 'admin' ORDER BY is_protected DESC, created_at ASC LIMIT 1").get(existing.id);
  if (!adminUser) return res.status(404).json({ error: "No se encontro el encargado de sistema" });
  const duplicateUser = db.prepare("SELECT id FROM users WHERE lower(username) = lower(?) AND id <> ?").get(company.adminUsername, adminUser.id);
  if (duplicateUser) return res.status(400).json({ error: "Ese usuario administrador ya existe" });

  db.exec("BEGIN");
  try {
    db.prepare(
      `UPDATE companies
       SET name = ?, slug = ?, plan = ?, billing_period = ?, status = ?, max_users = ?, max_units = ?, storage_mb = ?,
           contact_name = ?, contact_email = ?, contact_phone = ?, starts_at = ?, ends_at = ?, updated_at = ?
       WHERE id = ?`
    ).run(
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
    );
    db.prepare(
      `INSERT INTO organization_settings (id, company_id, company_name, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET company_name = excluded.company_name, updated_at = excluded.updated_at`
    ).run(existing.id, existing.id, company.name, now);
    db.prepare("UPDATE users SET name = ?, username = ?, phone = ? WHERE id = ?").run(
      company.adminName,
      company.adminUsername,
      company.contactPhone,
      adminUser.id
    );
    if (company.adminPassword) db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(bcrypt.hashSync(company.adminPassword, 12), adminUser.id);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    return res.status(400).json({ error: error.message || "No se pudo actualizar la empresa" });
  }

  recordAuditEvent({ req, action: "company_update", entityType: "company", entityId: existing.id, description: `Actualizo empresa ${company.name}`, metadata: { status: company.status, plan: company.plan } });
  res.json({ ok: true });
});

app.get("/api/systems", requireAuth, requireRole("zow_owner"), (req, res) => {
  ensureSaasSystems();
  const systems = db.prepare(`SELECT * FROM saas_systems WHERE id IN (${sqlPlaceholders(enabledPanelSystemIds)}) ORDER BY name`).all(...enabledPanelSystemIds);
  res.json({ systems });
});

app.get("/api/companies/:id/systems", requireAuth, requireRole("zow_owner"), (req, res) => {
  ensureSaasSystems();
  const company = db.prepare("SELECT id FROM companies WHERE id = ? AND id <> 'zow-internal'").get(req.params.id);
  if (!company) return res.status(404).json({ error: "Empresa no encontrada" });
  const systems = db
    .prepare(
      `SELECT saas_systems.*, COALESCE(company_system_access.status, 'inactive') AS access_status,
              COALESCE(company_system_access.plan, '') AS access_plan
       FROM saas_systems
       LEFT JOIN company_system_access ON company_system_access.system_id = saas_systems.id AND company_system_access.company_id = ?
       WHERE saas_systems.id IN (${sqlPlaceholders(enabledPanelSystemIds)})
       ORDER BY saas_systems.name`
    )
    .all(company.id, ...enabledPanelSystemIds);
  res.json({ systems });
});

app.patch("/api/companies/:id/systems", requireAuth, requireRole("zow_owner"), (req, res) => {
  const company = db.prepare("SELECT id FROM companies WHERE id = ? AND id <> 'zow-internal'").get(req.params.id);
  if (!company) return res.status(404).json({ error: "Empresa no encontrada" });
  const enabledSystems = Array.isArray(req.body.systems) ? req.body.systems.map(String) : [];
  const plan = String(req.body.plan || "basico");
  const now = new Date().toISOString();

  const systems = db.prepare("SELECT id FROM saas_systems").all().map((system) => system.id);
  const upsertAccess = db.prepare(
    `INSERT INTO company_system_access (company_id, system_id, status, plan, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(company_id, system_id) DO UPDATE SET status = excluded.status, plan = excluded.plan, updated_at = excluded.updated_at`
  );
  systems.forEach((systemId) => {
    upsertAccess.run(company.id, systemId, enabledSystems.includes(systemId) ? "active" : "inactive", plan, now);
  });
  recordAuditEvent({
    req,
    action: "company_systems_update",
    entityType: "company",
    entityId: company.id,
    description: "Actualizo accesos SaaS de empresa",
    metadata: { systems: enabledSystems, plan }
  });
  res.json({ ok: true });
});

app.get("/api/ventas/summary", requireAuth, requireSystemAccess("ventas_almacen"), (req, res) => {
  const ownOnly = ventasOwnOnly(req.user.role);
  const inventory = db
    .prepare(
      `SELECT COUNT(*) AS products,
              COALESCE(SUM(stock), 0) AS stock,
              COALESCE(SUM(stock * cost_price), 0) AS inventory_value,
              COALESCE(SUM(CASE WHEN stock <= min_stock THEN 1 ELSE 0 END), 0) AS low_stock
       FROM inventory_products
       WHERE company_id = ? AND is_active = 1`
    )
    .get(req.user.company_id);
  const sales = db
    .prepare(
      `SELECT COUNT(*) AS sales, COALESCE(SUM(total), 0) AS income
       FROM sales_orders
       WHERE company_id = ? AND status = 'confirmada' ${ownOnly ? "AND created_by = ?" : ""}`
    )
    .get(...(ownOnly ? [req.user.company_id, req.user.id] : [req.user.company_id]));
  const pendingCash = db
    .prepare(
      `SELECT COUNT(*) AS pending_sales,
              COALESCE(SUM(CASE WHEN payment_method = 'credito' THEN amount_paid ELSE total END), 0) AS pending_total
       FROM sales_orders
       WHERE company_id = ? AND status = 'confirmada' AND cash_closed = 0 ${ownOnly ? "AND created_by = ?" : ""}`
    )
    .get(...(ownOnly ? [req.user.company_id, req.user.id] : [req.user.company_id]));
  res.json({ summary: { ...inventory, ...sales, ...pendingCash } });
});

app.get("/api/ventas/settings", requireAuth, requireSystemAccess("ventas_almacen"), (req, res) => {
  res.json({ settings: mapSettings(loadSettings(req.user.company_id)) });
});

app.get("/api/ventas/audit", requireAuth, requireSystemAccess("ventas_almacen"), requireVentasRole("admin", "ventas_admin", "supervisor"), (req, res) => {
  const actions = [
    "sale_create",
    "sale_void",
    "sale_return",
    "credit_payment",
    "cash_open",
    "cash_close",
    "cash_movement",
    "product_create",
    "product_update",
    "product_status",
    "stock_movement"
  ];
  const placeholders = actions.map(() => "?").join(",");
  const events = db
    .prepare(
      `SELECT id, actor_name, action, entity_type, entity_id, description, metadata, ip_address, created_at
       FROM audit_events
       WHERE company_id = ? AND action IN (${placeholders})
       ORDER BY created_at DESC
       LIMIT 80`
    )
    .all(req.user.company_id, ...actions);
  res.json({ events });
});

app.patch("/api/ventas/settings", requireAuth, requireSystemAccess("ventas_almacen"), requireVentasRole("admin", "ventas_admin"), (req, res) => {
  const current = mapSettings(loadSettings(req.user.company_id));
  const settings = {
    companyName: String(req.body.companyName || current.companyName || "").trim(),
    storeName: String(req.body.storeName || "").trim(),
    currency: String(req.body.currency || current.currency || "BOB").trim().toUpperCase().slice(0, 8),
    taxId: String(req.body.taxId || "").trim(),
    phone: String(req.body.phone || "").trim(),
    address: String(req.body.address || "").trim(),
    ticketNote: String(req.body.ticketNote || "").trim(),
    cashRegisterCount: clampNumber(req.body.cashRegisterCount ?? current.cashRegisterCount, 1, 20, 1),
    taxRate: clampDecimal(req.body.taxRate ?? current.taxRate, 0, 100, 0),
    allowCredit: req.body.allowCredit !== false,
    allowDiscounts: req.body.allowDiscounts !== false,
    requireCustomerForSale: Boolean(req.body.requireCustomerForSale)
  };
  if (!settings.companyName) return res.status(400).json({ error: "Nombre de empresa obligatorio" });
  if (!settings.currency) return res.status(400).json({ error: "Moneda obligatoria" });

  db.prepare(
    `INSERT INTO organization_settings (
       id, company_id, company_name, store_name, currency, tax_id, phone, address, ticket_note, cash_register_count,
       tax_rate, allow_credit, allow_discounts, require_customer_sale, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       company_name = excluded.company_name,
       store_name = excluded.store_name,
       currency = excluded.currency,
       tax_id = excluded.tax_id,
       phone = excluded.phone,
       address = excluded.address,
       ticket_note = excluded.ticket_note,
       cash_register_count = excluded.cash_register_count,
       tax_rate = excluded.tax_rate,
       allow_credit = excluded.allow_credit,
       allow_discounts = excluded.allow_discounts,
       require_customer_sale = excluded.require_customer_sale,
       updated_at = excluded.updated_at`
  ).run(
    req.user.company_id,
    req.user.company_id,
    settings.companyName,
    settings.storeName,
    settings.currency,
    settings.taxId,
    settings.phone,
    settings.address,
    settings.ticketNote,
    settings.cashRegisterCount,
    settings.taxRate,
    settings.allowCredit ? 1 : 0,
    settings.allowDiscounts ? 1 : 0,
    settings.requireCustomerForSale ? 1 : 0,
    new Date().toISOString()
  );

  res.json({ settings: mapSettings(loadSettings(req.user.company_id)) });
});

app.get("/api/ventas/products", requireAuth, requireSystemAccess("ventas_almacen"), (req, res) => {
  const products = db
    .prepare("SELECT * FROM inventory_products WHERE company_id = ? ORDER BY name")
    .all(req.user.company_id);
  res.json({ products });
});

app.post("/api/ventas/products", requireAuth, requireSystemAccess("ventas_almacen"), requireVentasRole("admin", "ventas_admin", "almacen"), (req, res) => {
  const now = new Date().toISOString();
  const product = {
    id: randomUUID(),
    code: String(req.body.code || "").trim().toUpperCase(),
    barcode: String(req.body.barcode || "").trim().slice(0, 80),
    name: String(req.body.name || "").trim(),
    category: String(req.body.category || "").trim(),
    unit: String(req.body.unit || "Unidad").trim(),
    batchNumber: String(req.body.batchNumber || "").trim().slice(0, 80),
    expiresAt: String(req.body.expiresAt || "").trim().slice(0, 10),
    costPrice: Number(req.body.costPrice || 0),
    salePrice: Number(req.body.salePrice || 0),
    minStock: Number(req.body.minStock || 0),
    stock: Number(req.body.stock || 0)
  };
  if (!product.code || !product.name) return res.status(400).json({ error: "Codigo y nombre son obligatorios" });
  if (product.barcode) {
    const duplicateBarcode = db
      .prepare("SELECT id FROM inventory_products WHERE company_id = ? AND barcode <> '' AND lower(barcode) = lower(?)")
      .get(req.user.company_id, product.barcode);
    if (duplicateBarcode) return res.status(400).json({ error: "Ya existe otro producto con ese codigo de barras" });
  }

  db.prepare(
    `INSERT INTO inventory_products (id, company_id, code, barcode, name, category, unit, batch_number, expires_at, cost_price, sale_price, min_stock, stock, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    product.id,
    req.user.company_id,
    product.code,
    product.barcode,
    product.name,
    product.category,
    product.unit,
    product.batchNumber,
    product.expiresAt,
    product.costPrice,
    product.salePrice,
    product.minStock,
    product.stock,
    now,
    now
  );

  if (product.stock !== 0) {
    db.prepare(
      `INSERT INTO inventory_movements (id, company_id, product_id, type, quantity, reference, note, created_by, created_at)
       VALUES (?, ?, ?, 'entrada', ?, ?, ?, ?, ?)`
    ).run(randomUUID(), req.user.company_id, product.id, product.stock, "Stock inicial", "Registro inicial de producto", req.user.id, now);
  }
  recordAuditEvent({
    req,
    action: "product_create",
    entityType: "product",
    entityId: product.id,
    description: `Creo producto ${product.code} - ${product.name}`,
    metadata: { stock: product.stock, cost: product.costPrice, price: product.salePrice, barcode: product.barcode }
  });

  res.status(201).json({ product: db.prepare("SELECT * FROM inventory_products WHERE id = ?").get(product.id) });
});

app.patch("/api/ventas/products/:id", requireAuth, requireSystemAccess("ventas_almacen"), requireVentasRole("admin", "ventas_admin", "almacen"), (req, res) => {
  const existing = db.prepare("SELECT * FROM inventory_products WHERE id = ? AND company_id = ?").get(req.params.id, req.user.company_id);
  if (!existing) return res.status(404).json({ error: "Producto no encontrado" });
  const now = new Date().toISOString();
  const product = {
    code: String(req.body.code || "").trim().toUpperCase(),
    barcode: String(req.body.barcode || "").trim().slice(0, 80),
    name: String(req.body.name || "").trim(),
    category: String(req.body.category || "").trim(),
    unit: String(req.body.unit || "Unidad").trim(),
    batchNumber: String(req.body.batchNumber || "").trim().slice(0, 80),
    expiresAt: String(req.body.expiresAt || "").trim().slice(0, 10),
    costPrice: Number(req.body.costPrice || 0),
    salePrice: Number(req.body.salePrice || 0),
    minStock: Number(req.body.minStock || 0)
  };
  if (!product.code || !product.name) return res.status(400).json({ error: "Codigo y nombre son obligatorios" });
  const duplicate = db
    .prepare("SELECT id FROM inventory_products WHERE company_id = ? AND upper(code) = upper(?) AND id <> ?")
    .get(req.user.company_id, product.code, existing.id);
  if (duplicate) return res.status(400).json({ error: "Ya existe otro producto con ese codigo" });
  if (product.barcode) {
    const duplicateBarcode = db
      .prepare("SELECT id FROM inventory_products WHERE company_id = ? AND barcode <> '' AND lower(barcode) = lower(?) AND id <> ?")
      .get(req.user.company_id, product.barcode, existing.id);
    if (duplicateBarcode) return res.status(400).json({ error: "Ya existe otro producto con ese codigo de barras" });
  }
  db.prepare(
    `UPDATE inventory_products
     SET code = ?, barcode = ?, name = ?, category = ?, unit = ?, batch_number = ?, expires_at = ?, cost_price = ?, sale_price = ?, min_stock = ?, updated_at = ?
     WHERE id = ? AND company_id = ?`
  ).run(product.code, product.barcode, product.name, product.category, product.unit, product.batchNumber, product.expiresAt, product.costPrice, product.salePrice, product.minStock, now, existing.id, req.user.company_id);
  recordAuditEvent({
    req,
    action: "product_update",
    entityType: "product",
    entityId: existing.id,
    description: `Actualizo producto ${product.code}`,
    metadata: {
      previous: { code: existing.code, price: existing.sale_price, cost: existing.cost_price, stock: existing.stock },
      next: { code: product.code, price: product.salePrice, cost: product.costPrice, minStock: product.minStock }
    }
  });
  res.json({ product: db.prepare("SELECT * FROM inventory_products WHERE id = ? AND company_id = ?").get(existing.id, req.user.company_id) });
});

app.patch("/api/ventas/products/:id/status", requireAuth, requireSystemAccess("ventas_almacen"), requireVentasRole("admin", "ventas_admin", "almacen"), (req, res) => {
  const product = db.prepare("SELECT id, name, is_active FROM inventory_products WHERE id = ? AND company_id = ?").get(req.params.id, req.user.company_id);
  if (!product) return res.status(404).json({ error: "Producto no encontrado" });
  const active = req.body.active ? 1 : 0;
  db.prepare("UPDATE inventory_products SET is_active = ?, updated_at = ? WHERE id = ? AND company_id = ?").run(active, new Date().toISOString(), product.id, req.user.company_id);
  recordAuditEvent({ req, action: "product_status", entityType: "product", entityId: product.id, description: `${active ? "Activo" : "Desactivo"} producto ${product.name}` });
  res.json({ product: db.prepare("SELECT * FROM inventory_products WHERE id = ? AND company_id = ?").get(product.id, req.user.company_id) });
});

app.get("/api/ventas/categories", requireAuth, requireSystemAccess("ventas_almacen"), (req, res) => {
  const categories = db.prepare("SELECT * FROM inventory_categories WHERE company_id = ? ORDER BY name").all(req.user.company_id);
  res.json({ categories });
});

app.post("/api/ventas/categories", requireAuth, requireSystemAccess("ventas_almacen"), requireVentasRole("admin", "ventas_admin", "almacen"), (req, res) => {
  const category = {
    id: randomUUID(),
    name: String(req.body.name || "").trim(),
    description: String(req.body.description || "").trim()
  };
  if (!category.name) return res.status(400).json({ error: "Nombre de categoria obligatorio" });
  db.prepare("INSERT INTO inventory_categories (id, company_id, name, description) VALUES (?, ?, ?, ?)").run(
    category.id,
    req.user.company_id,
    category.name,
    category.description
  );
  res.status(201).json({ category });
});

app.get("/api/ventas/customers", requireAuth, requireSystemAccess("ventas_almacen"), (req, res) => {
  const customers = db.prepare("SELECT * FROM sales_customers WHERE company_id = ? ORDER BY name").all(req.user.company_id);
  res.json({ customers });
});

app.post("/api/ventas/customers", requireAuth, requireSystemAccess("ventas_almacen"), requireVentasRole("admin", "ventas_admin", "cajero", "vendedor"), (req, res) => {
  const now = new Date().toISOString();
  const customer = {
    id: randomUUID(),
    name: String(req.body.name || "").trim(),
    phone: String(req.body.phone || "").trim(),
    ci: String(req.body.ci || "").trim(),
    email: String(req.body.email || "").trim(),
    address: String(req.body.address || "").trim(),
    status: ["activo", "observado", "bloqueado"].includes(String(req.body.status || "")) ? String(req.body.status) : "activo",
    creditLimit: Number(req.body.creditLimit || 0)
  };
  if (!customer.name) return res.status(400).json({ error: "Nombre de cliente obligatorio" });
  db.prepare(
    `INSERT INTO sales_customers (id, company_id, name, phone, ci, email, address, status, credit_limit, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(customer.id, req.user.company_id, customer.name, customer.phone, customer.ci, customer.email, customer.address, customer.status, customer.creditLimit, now, now);
  res.status(201).json({ customer });
});

app.patch("/api/ventas/customers/:id", requireAuth, requireSystemAccess("ventas_almacen"), requireVentasRole("admin", "ventas_admin", "cajero", "vendedor"), (req, res) => {
  const existing = db.prepare("SELECT * FROM sales_customers WHERE id = ? AND company_id = ?").get(req.params.id, req.user.company_id);
  if (!existing) return res.status(404).json({ error: "Cliente no encontrado" });
  const customer = {
    name: String(req.body.name || "").trim(),
    phone: String(req.body.phone || "").trim(),
    ci: String(req.body.ci || "").trim(),
    email: String(req.body.email || "").trim(),
    address: String(req.body.address || "").trim(),
    status: ["activo", "observado", "bloqueado"].includes(String(req.body.status || "")) ? String(req.body.status) : "activo",
    creditLimit: Number(req.body.creditLimit || 0)
  };
  if (!customer.name) return res.status(400).json({ error: "Nombre de cliente obligatorio" });
  db.prepare(
    `UPDATE sales_customers SET name = ?, phone = ?, ci = ?, email = ?, address = ?, status = ?, credit_limit = ?, updated_at = ?
     WHERE id = ? AND company_id = ?`
  ).run(customer.name, customer.phone, customer.ci, customer.email, customer.address, customer.status, customer.creditLimit, new Date().toISOString(), existing.id, req.user.company_id);
  res.json({ customer: db.prepare("SELECT * FROM sales_customers WHERE id = ? AND company_id = ?").get(existing.id, req.user.company_id) });
});

app.get("/api/ventas/receivables", requireAuth, requireSystemAccess("ventas_almacen"), requireVentasRole("admin", "ventas_admin", "cajero", "vendedor", "supervisor"), (req, res) => {
  const ownOnly = ventasOwnOnly(req.user.role);
  const sales = db
    .prepare(
      `SELECT sales_orders.*, users.name AS seller_name
       FROM sales_orders
       LEFT JOIN users ON users.id = sales_orders.created_by
       WHERE sales_orders.company_id = ?
         AND sales_orders.status = 'confirmada'
         AND sales_orders.balance_due > 0
         ${ownOnly ? "AND sales_orders.created_by = ?" : ""}
       ORDER BY sales_orders.created_at DESC`
    )
    .all(...(ownOnly ? [req.user.company_id, req.user.id] : [req.user.company_id]));
  res.json({ receivables: sales });
});

app.get("/api/ventas/suppliers", requireAuth, requireSystemAccess("ventas_almacen"), requireVentasRole("admin", "ventas_admin", "almacen", "supervisor"), (req, res) => {
  const suppliers = db.prepare("SELECT * FROM purchase_suppliers WHERE company_id = ? ORDER BY name").all(req.user.company_id);
  res.json({ suppliers });
});

app.post("/api/ventas/suppliers", requireAuth, requireSystemAccess("ventas_almacen"), requireVentasRole("admin", "ventas_admin", "almacen"), (req, res) => {
  const now = new Date().toISOString();
  const supplier = {
    id: randomUUID(),
    name: String(req.body.name || "").trim(),
    phone: String(req.body.phone || "").trim(),
    taxId: String(req.body.taxId || "").trim(),
    address: String(req.body.address || "").trim()
  };
  if (!supplier.name) return res.status(400).json({ error: "Nombre de proveedor obligatorio" });
  db.prepare(
    `INSERT INTO purchase_suppliers (id, company_id, name, phone, tax_id, address, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(supplier.id, req.user.company_id, supplier.name, supplier.phone, supplier.taxId, supplier.address, now, now);
  res.status(201).json({ supplier: db.prepare("SELECT * FROM purchase_suppliers WHERE id = ?").get(supplier.id) });
});

app.get("/api/ventas/purchases", requireAuth, requireSystemAccess("ventas_almacen"), requireVentasRole("admin", "ventas_admin", "almacen", "supervisor"), (req, res) => {
  const purchases = db
    .prepare(
      `SELECT purchase_orders.*, users.name AS created_by_name
       FROM purchase_orders
       LEFT JOIN users ON users.id = purchase_orders.created_by
       WHERE purchase_orders.company_id = ?
       ORDER BY purchase_orders.created_at DESC`
    )
    .all(req.user.company_id);
  res.json({ purchases });
});

app.post("/api/ventas/purchases", requireAuth, requireSystemAccess("ventas_almacen"), requireVentasRole("admin", "ventas_admin", "almacen"), (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({ error: "Agrega al menos un producto a la compra" });
  const now = new Date().toISOString();
  const purchaseId = randomUUID();
  const purchaseCode = buildNextPurchaseCode(req.user.company_id, now);
  const supplierId = String(req.body.supplierId || "").trim();
  const requestedStatus = String(req.body.status || "confirmada").trim();
  const status = requestedStatus === "pendiente" ? "pendiente" : "confirmada";
  const supplier = supplierId ? db.prepare("SELECT * FROM purchase_suppliers WHERE id = ? AND company_id = ?").get(supplierId, req.user.company_id) : null;
  const supplierName = supplier?.name || String(req.body.supplierName || "Proveedor sin registrar").trim();

  let preparedItems;
  try {
    preparedItems = items.map((item) => {
      const product = db.prepare("SELECT * FROM inventory_products WHERE id = ? AND company_id = ?").get(String(item.productId || ""), req.user.company_id);
      const quantity = Number(item.quantity || 0);
      const unitCost = Number(item.unitCost || product?.cost_price || 0);
      if (!product || quantity <= 0) throw new Error("Producto o cantidad invalida");
      return { product, quantity, unitCost, total: quantity * unitCost };
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo preparar la compra" });
  }

  const total = preparedItems.reduce((sum, item) => sum + item.total, 0);
  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO purchase_orders (id, company_id, code, supplier_id, supplier_name, invoice_number, note, total, status, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(purchaseId, req.user.company_id, purchaseCode, supplier?.id || null, supplierName, String(req.body.invoiceNumber || "").trim(), String(req.body.note || "").trim(), total, status, req.user.id, now);
    const insertItem = db.prepare(
      `INSERT INTO purchase_order_items (id, company_id, purchase_id, product_id, product_name, quantity, unit_cost, total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertMovement = db.prepare(
      `INSERT INTO inventory_movements (id, company_id, product_id, type, quantity, reference, note, created_by, created_at)
       VALUES (?, ?, ?, 'entrada', ?, ?, ?, ?, ?)`
    );
    const updateProduct = db.prepare("UPDATE inventory_products SET stock = stock + ?, cost_price = ?, updated_at = ? WHERE id = ? AND company_id = ?");
    preparedItems.forEach((item) => {
      insertItem.run(randomUUID(), req.user.company_id, purchaseId, item.product.id, item.product.name, item.quantity, item.unitCost, item.total);
      if (status === "confirmada") {
        insertMovement.run(randomUUID(), req.user.company_id, item.product.id, item.quantity, purchaseCode, `Compra confirmada: ${supplierName}`, req.user.id, now);
        updateProduct.run(item.quantity, item.unitCost, now, item.product.id, req.user.company_id);
      }
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    return res.status(400).json({ error: error.message || "No se pudo registrar la compra" });
  }
  res.status(201).json({
    purchase: db.prepare("SELECT * FROM purchase_orders WHERE id = ? AND company_id = ?").get(purchaseId, req.user.company_id),
    items: db.prepare("SELECT * FROM purchase_order_items WHERE purchase_id = ? AND company_id = ?").all(purchaseId, req.user.company_id)
  });
});

app.patch("/api/ventas/purchases/:id/receive", requireAuth, requireSystemAccess("ventas_almacen"), requireVentasRole("admin", "ventas_admin", "almacen"), (req, res) => {
  const purchase = db.prepare("SELECT * FROM purchase_orders WHERE id = ? AND company_id = ?").get(req.params.id, req.user.company_id);
  if (!purchase) return res.status(404).json({ error: "Orden de compra no encontrada" });
  if (purchase.status !== "pendiente") return res.status(400).json({ error: "Solo se pueden recibir ordenes pendientes" });
  const items = db.prepare("SELECT * FROM purchase_order_items WHERE purchase_id = ? AND company_id = ?").all(purchase.id, req.user.company_id);
  if (!items.length) return res.status(400).json({ error: "La orden no tiene productos" });
  const now = new Date().toISOString();
  db.exec("BEGIN");
  try {
    const insertMovement = db.prepare(
      `INSERT INTO inventory_movements (id, company_id, product_id, type, quantity, reference, note, created_by, created_at)
       VALUES (?, ?, ?, 'entrada', ?, ?, ?, ?, ?)`
    );
    const updateProduct = db.prepare("UPDATE inventory_products SET stock = stock + ?, cost_price = ?, updated_at = ? WHERE id = ? AND company_id = ?");
    items.forEach((item) => {
      insertMovement.run(randomUUID(), req.user.company_id, item.product_id, Number(item.quantity || 0), purchase.code, `Recepcion de orden: ${purchase.supplier_name || "Proveedor"}`, req.user.id, now);
      updateProduct.run(Number(item.quantity || 0), Number(item.unit_cost || 0), now, item.product_id, req.user.company_id);
    });
    db.prepare("UPDATE purchase_orders SET status = 'recibida', received_at = ? WHERE id = ? AND company_id = ?").run(now, purchase.id, req.user.company_id);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    return res.status(400).json({ error: error.message || "No se pudo recibir la orden" });
  }
  res.json({ purchase: db.prepare("SELECT * FROM purchase_orders WHERE id = ? AND company_id = ?").get(purchase.id, req.user.company_id) });
});

app.patch("/api/ventas/purchases/:id/cancel", requireAuth, requireSystemAccess("ventas_almacen"), requireVentasRole("admin", "ventas_admin", "almacen"), (req, res) => {
  const purchase = db.prepare("SELECT * FROM purchase_orders WHERE id = ? AND company_id = ?").get(req.params.id, req.user.company_id);
  if (!purchase) return res.status(404).json({ error: "Orden de compra no encontrada" });
  if (purchase.status !== "pendiente") return res.status(400).json({ error: "Solo se pueden cancelar ordenes pendientes" });
  db.prepare("UPDATE purchase_orders SET status = 'cancelada', cancelled_at = ? WHERE id = ? AND company_id = ?").run(new Date().toISOString(), purchase.id, req.user.company_id);
  res.json({ purchase: db.prepare("SELECT * FROM purchase_orders WHERE id = ? AND company_id = ?").get(purchase.id, req.user.company_id) });
});

app.get("/api/ventas/sales", requireAuth, requireSystemAccess("ventas_almacen"), (req, res) => {
  const ownOnly = ventasOwnOnly(req.user.role);
  const sales = db
    .prepare(
      `SELECT sales_orders.*, users.name AS seller_name
       FROM sales_orders
       LEFT JOIN users ON users.id = sales_orders.created_by
       WHERE sales_orders.company_id = ? ${ownOnly ? "AND sales_orders.created_by = ?" : ""}
       ORDER BY sales_orders.created_at DESC`
    )
    .all(...(ownOnly ? [req.user.company_id, req.user.id] : [req.user.company_id]));
  res.json({ sales });
});

app.get("/api/ventas/sales/:id", requireAuth, requireSystemAccess("ventas_almacen"), (req, res) => {
  const sale = db.prepare("SELECT * FROM sales_orders WHERE id = ? AND company_id = ?").get(req.params.id, req.user.company_id);
  if (!sale) return res.status(404).json({ error: "Venta no encontrada" });
  if (ventasOwnOnly(req.user.role) && sale.created_by !== req.user.id) {
    return res.status(403).json({ error: "Permiso insuficiente" });
  }
  const items = db.prepare("SELECT * FROM sales_order_items WHERE sale_id = ? AND company_id = ?").all(sale.id, req.user.company_id);
  res.json({ sale, items });
});

app.post("/api/ventas/sales/:id/void", requireAuth, requireSystemAccess("ventas_almacen"), requireVentasRole("admin", "ventas_admin", "supervisor", "cajero"), (req, res) => {
  const sale = db.prepare("SELECT * FROM sales_orders WHERE id = ? AND company_id = ?").get(req.params.id, req.user.company_id);
  if (!sale) return res.status(404).json({ error: "Venta no encontrada" });
  if (ventasOwnOnly(req.user.role) && sale.created_by !== req.user.id) {
    return res.status(403).json({ error: "Permiso insuficiente" });
  }
  if (sale.status === "anulada") return res.status(400).json({ error: "La venta ya fue anulada" });
  if (Number(sale.cash_closed || 0)) return res.status(400).json({ error: "No se puede anular una venta con caja cerrada" });
  const reason = String(req.body.reason || "").trim();
  if (!reason) return res.status(400).json({ error: "Motivo de anulacion obligatorio" });

  const items = db.prepare("SELECT * FROM sales_order_items WHERE sale_id = ? AND company_id = ?").all(sale.id, req.user.company_id);
  const now = new Date().toISOString();
  db.exec("BEGIN");
  try {
    db.prepare("UPDATE sales_orders SET status = 'anulada' WHERE id = ? AND company_id = ?").run(sale.id, req.user.company_id);
    const restoreStock = db.prepare("UPDATE inventory_products SET stock = stock + ?, updated_at = ? WHERE id = ? AND company_id = ?");
    const insertMovement = db.prepare(
      `INSERT INTO inventory_movements (id, company_id, product_id, type, quantity, reference, note, created_by, created_at)
       VALUES (?, ?, ?, 'entrada', ?, ?, ?, ?, ?)`
    );
    items.forEach((item) => {
      const quantity = Number(item.quantity || 0);
      if (!item.product_id || quantity <= 0) return;
      restoreStock.run(quantity, now, item.product_id, req.user.company_id);
      insertMovement.run(randomUUID(), req.user.company_id, item.product_id, quantity, sale.code, `Anulacion de venta: ${reason}`, req.user.id, now);
    });
    db.exec("COMMIT");
    recordAuditEvent({ req, action: "sale_void", entityType: "sale", entityId: sale.id, description: `Anulo venta ${sale.code}: ${reason}` });
  } catch (error) {
    db.exec("ROLLBACK");
    return res.status(400).json({ error: error.message || "No se pudo anular la venta" });
  }

  res.json({
    sale: db.prepare("SELECT * FROM sales_orders WHERE id = ? AND company_id = ?").get(sale.id, req.user.company_id),
    items
  });
});

app.post("/api/ventas/sales/:id/pay", requireAuth, requireSystemAccess("ventas_almacen"), requireVentasRole("admin", "ventas_admin", "cajero", "vendedor"), (req, res) => {
  const sale = db.prepare("SELECT * FROM sales_orders WHERE id = ? AND company_id = ?").get(req.params.id, req.user.company_id);
  if (!sale) return res.status(404).json({ error: "Venta no encontrada" });
  if (ventasOwnOnly(req.user.role) && sale.created_by !== req.user.id) return res.status(403).json({ error: "Permiso insuficiente" });
  if (sale.status === "anulada") return res.status(400).json({ error: "No se puede cobrar una venta anulada" });
  const balance = Number(sale.balance_due || 0);
  const amount = Number(req.body.amount || 0);
  const method = String(req.body.paymentMethod || "efectivo").trim();
  if (balance <= 0) return res.status(400).json({ error: "La venta no tiene saldo pendiente" });
  if (amount <= 0 || amount > balance) return res.status(400).json({ error: "Monto de pago invalido" });
  const nextPaid = Number(sale.amount_paid || 0) + amount;
  const nextBalance = Math.max(balance - amount, 0);
  db.prepare(
    `UPDATE sales_orders
     SET amount_paid = ?, balance_due = ?, payment_method = ?, payment_status = ?
     WHERE id = ? AND company_id = ?`
  ).run(nextPaid, nextBalance, method, nextBalance > 0 ? "pendiente" : "pagada", sale.id, req.user.company_id);
  const session = db
    .prepare("SELECT * FROM cash_sessions WHERE company_id = ? AND opened_by = ? AND status = 'abierta'")
    .get(req.user.company_id, req.user.id);
  if (session) {
    db.prepare(
      `INSERT INTO cash_movements (id, company_id, session_id, type, amount, reason, created_by, created_at)
       VALUES (?, ?, ?, 'ingreso', ?, ?, ?, ?)`
    ).run(randomUUID(), req.user.company_id, session.id, amount, `Cobro de credito ${sale.code}`, req.user.id, new Date().toISOString());
  }
  recordAuditEvent({
    req,
    action: "credit_payment",
    entityType: "sale",
    entityId: sale.id,
    description: `Cobro credito ${sale.code} por ${amount}`,
    metadata: { previousBalance: balance, nextBalance, paymentMethod: method }
  });
  res.json({ sale: db.prepare("SELECT * FROM sales_orders WHERE id = ? AND company_id = ?").get(sale.id, req.user.company_id) });
});

app.post("/api/ventas/sales/:id/returns", requireAuth, requireSystemAccess("ventas_almacen"), requireVentasRole("admin", "ventas_admin", "supervisor", "cajero"), (req, res) => {
  const sale = db.prepare("SELECT * FROM sales_orders WHERE id = ? AND company_id = ?").get(req.params.id, req.user.company_id);
  if (!sale) return res.status(404).json({ error: "Venta no encontrada" });
  if (ventasOwnOnly(req.user.role) && sale.created_by !== req.user.id) return res.status(403).json({ error: "Permiso insuficiente" });
  if (sale.status === "anulada") return res.status(400).json({ error: "No se puede devolver una venta anulada" });
  const requestedItems = Array.isArray(req.body.items) ? req.body.items : [];
  const reason = String(req.body.reason || "").trim();
  const refundAmount = Number(req.body.refundAmount || 0);
  if (!reason) return res.status(400).json({ error: "Motivo de devolucion obligatorio" });
  if (!requestedItems.length) return res.status(400).json({ error: "Selecciona al menos un producto para devolver" });
  const saleItems = db.prepare("SELECT * FROM sales_order_items WHERE sale_id = ? AND company_id = ?").all(sale.id, req.user.company_id);
  const returnedRows = db
    .prepare("SELECT product_id, COALESCE(SUM(quantity), 0) AS returned FROM sales_return_items WHERE company_id = ? AND sale_id = ? GROUP BY product_id")
    .all(req.user.company_id, sale.id);
  const returnedByProduct = new Map(returnedRows.map((item) => [item.product_id, Number(item.returned || 0)]));
  let prepared;
  try {
    prepared = requestedItems.map((item) => {
      const saleItem = saleItems.find((entry) => entry.product_id === String(item.productId || ""));
      const quantity = Number(item.quantity || 0);
      if (!saleItem || quantity <= 0) throw new Error("Producto o cantidad invalida");
      const available = Number(saleItem.quantity || 0) - Number(returnedByProduct.get(saleItem.product_id) || 0);
      if (quantity > available) throw new Error(`No puedes devolver mas de ${available} unidad(es) de ${saleItem.product_name}`);
      const unitPrice = Number(saleItem.unit_price || 0);
      return { saleItem, quantity, unitPrice, total: quantity * unitPrice };
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo preparar la devolucion" });
  }
  const totalReturn = prepared.reduce((sum, item) => sum + item.total, 0);
  if (refundAmount < 0 || refundAmount > totalReturn) return res.status(400).json({ error: "Monto devuelto invalido" });
  const session = refundAmount > 0
    ? db.prepare("SELECT * FROM cash_sessions WHERE company_id = ? AND opened_by = ? AND status = 'abierta'").get(req.user.company_id, req.user.id)
    : null;
  if (refundAmount > 0 && !session) return res.status(400).json({ error: "Abre caja para registrar devolucion de dinero" });
  const now = new Date().toISOString();
  const returnId = randomUUID();
  const returnCode = buildNextSalesReturnCode(req.user.company_id, now);
  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO sales_returns (id, company_id, sale_id, code, reason, refund_amount, total, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(returnId, req.user.company_id, sale.id, returnCode, reason, refundAmount, totalReturn, req.user.id, now);
    const insertReturnItem = db.prepare(
      `INSERT INTO sales_return_items (id, company_id, return_id, sale_id, product_id, product_name, quantity, unit_price, total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const restoreStock = db.prepare("UPDATE inventory_products SET stock = stock + ?, updated_at = ? WHERE id = ? AND company_id = ?");
    const insertMovement = db.prepare(
      `INSERT INTO inventory_movements (id, company_id, product_id, type, quantity, reference, note, created_by, created_at)
       VALUES (?, ?, ?, 'entrada', ?, ?, ?, ?, ?)`
    );
    prepared.forEach((item) => {
      insertReturnItem.run(randomUUID(), req.user.company_id, returnId, sale.id, item.saleItem.product_id, item.saleItem.product_name, item.quantity, item.unitPrice, item.total);
      restoreStock.run(item.quantity, now, item.saleItem.product_id, req.user.company_id);
      insertMovement.run(randomUUID(), req.user.company_id, item.saleItem.product_id, item.quantity, returnCode, `Devolucion de venta ${sale.code}: ${reason}`, req.user.id, now);
    });
    if (refundAmount > 0) {
      db.prepare(
        `INSERT INTO cash_movements (id, company_id, session_id, type, amount, reason, created_by, created_at)
         VALUES (?, ?, ?, 'egreso', ?, ?, ?, ?)`
      ).run(randomUUID(), req.user.company_id, session.id, refundAmount, `Devolucion ${returnCode} / ${sale.code}`, req.user.id, now);
    }
    const totalSold = saleItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const previousReturned = [...returnedByProduct.values()].reduce((sum, value) => sum + Number(value || 0), 0);
    const nextReturned = previousReturned + prepared.reduce((sum, item) => sum + item.quantity, 0);
    db.prepare(
      `UPDATE sales_orders SET returned_amount = COALESCE(returned_amount, 0) + ?, return_status = ?, updated_at = ? WHERE id = ? AND company_id = ?`
    ).run(refundAmount, nextReturned >= totalSold ? "total" : "parcial", now, sale.id, req.user.company_id);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    return res.status(400).json({ error: error.message || "No se pudo registrar la devolucion" });
  }
  recordAuditEvent({ req, action: "sale_return", entityType: "sale", entityId: sale.id, description: `Devolucion ${returnCode} de venta ${sale.code}: ${reason}` });
  res.status(201).json({
    sale: db.prepare("SELECT * FROM sales_orders WHERE id = ? AND company_id = ?").get(sale.id, req.user.company_id),
    return: db.prepare("SELECT * FROM sales_returns WHERE id = ? AND company_id = ?").get(returnId, req.user.company_id)
  });
});

app.post("/api/ventas/sales", requireAuth, requireSystemAccess("ventas_almacen"), requireVentasRole("admin", "ventas_admin", "cajero", "vendedor"), (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({ error: "Agrega al menos un producto a la venta" });

  const now = new Date().toISOString();
  const saleId = randomUUID();
  const saleCode = buildNextSaleCode(req.user.company_id, now);
  const customerId = String(req.body.customerId || "").trim();
  const customer = customerId ? db.prepare("SELECT * FROM sales_customers WHERE id = ? AND company_id = ?").get(customerId, req.user.company_id) : null;
  const customerName = customer?.name || String(req.body.customerName || "Cliente sin registrar").trim();
  const settings = mapSettings(loadSettings(req.user.company_id));
  const note = String(req.body.note || "").trim().slice(0, 500);
  const cashSession = db
    .prepare("SELECT * FROM cash_sessions WHERE company_id = ? AND opened_by = ? AND status = 'abierta'")
    .get(req.user.company_id, req.user.id);
  if (!cashSession) return res.status(400).json({ error: "Abre caja antes de confirmar ventas" });
  if (settings.requireCustomerForSale && !customer) return res.status(400).json({ error: "Selecciona un cliente registrado para confirmar la venta" });
  if (customer?.status === "bloqueado") return res.status(400).json({ error: "Cliente bloqueado para ventas" });

  let preparedItems;
  try {
    preparedItems = items.map((item) => {
      const product = db.prepare("SELECT * FROM inventory_products WHERE id = ? AND company_id = ? AND is_active = 1").get(String(item.productId || ""), req.user.company_id);
      const quantity = Number(item.quantity || 0);
      if (!product || quantity <= 0) throw new Error("Producto o cantidad invalida");
      if (Number(product.stock) < quantity) throw new Error(`Stock insuficiente para ${product.name}`);
      return {
        product,
        quantity,
        unitPrice: Number(item.unitPrice || product.sale_price || 0),
        costPriceAtSale: Number(product.cost_price || 0),
        subtotal: quantity * Number(item.unitPrice || product.sale_price || 0),
        discount: Math.min(Math.max(Number(item.discount || 0), 0), quantity * Number(item.unitPrice || product.sale_price || 0)),
        total: Math.max(quantity * Number(item.unitPrice || product.sale_price || 0) - Math.min(Math.max(Number(item.discount || 0), 0), quantity * Number(item.unitPrice || product.sale_price || 0)), 0)
      };
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo preparar la venta" });
  }

  const subtotal = preparedItems.reduce((total, item) => total + item.subtotal, 0);
  const lineDiscountTotal = preparedItems.reduce((total, item) => total + item.discount, 0);
  const requestedDiscount = Math.max(Number(req.body.discount || 0), 0);
  const orderDiscount = Math.max(requestedDiscount - lineDiscountTotal, 0);
  const discount = Math.min(lineDiscountTotal + orderDiscount, subtotal);
  if (!settings.allowDiscounts && discount > 0) return res.status(400).json({ error: "Los descuentos estan desactivados para esta tienda" });
  const taxableBase = Math.max(subtotal - discount, 0);
  const tax = Number((taxableBase * Number(settings.taxRate || 0) / 100).toFixed(2));
  const total = Math.max(taxableBase + tax, 0);
  const paymentMethod = String(req.body.paymentMethod || "efectivo").trim();
  if (!settings.allowCredit && paymentMethod === "credito") return res.status(400).json({ error: "Las ventas al credito estan desactivadas para esta tienda" });
  let paymentDetail;
  try {
    paymentDetail = normalizePaymentDetail(req.body.paymentDetail, total, paymentMethod);
  } catch (error) {
    return res.status(400).json({ error: error.message || "Pago mixto invalido" });
  }
  const cashReceived = paymentMethod === "credito" ? Number(req.body.cashReceived || 0) : paymentMethod === "mixto" ? paymentDetail.totalPaid : Number(req.body.cashReceived || total);
  const amountPaid = Math.min(Math.max(cashReceived, 0), total);
  const balanceDue = Math.max(total - amountPaid, 0);
  const changeAmount = paymentMethod === "mixto" ? Math.max(paymentDetail.cash - Math.max(total - paymentDetail.nonCash, 0), 0) : Math.max(cashReceived - total, 0);
  if (paymentMethod === "credito") {
    if (!customer) return res.status(400).json({ error: "Selecciona un cliente registrado para ventas al credito" });
    const currentDebt = db
      .prepare("SELECT COALESCE(SUM(balance_due), 0) AS debt FROM sales_orders WHERE company_id = ? AND customer_id = ? AND status = 'confirmada' AND balance_due > 0")
      .get(req.user.company_id, customer.id);
    const creditLimit = Number(customer.credit_limit || 0);
    if (creditLimit > 0 && Number(currentDebt.debt || 0) + balanceDue > creditLimit) {
      return res.status(400).json({ error: "La venta supera el limite de credito del cliente" });
    }
  }

  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO sales_orders (
        id, company_id, cash_session_id, code, customer_id, customer_name, subtotal, discount, tax, total, note,
        cash_received, change_amount, payment_method, payment_detail, amount_paid, balance_due, payment_status,
        status, cash_closed, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmada', 0, ?, ?)`
    ).run(saleId, req.user.company_id, cashSession.id, saleCode, customer?.id || null, customerName, subtotal, discount, tax, total, note, cashReceived, changeAmount, paymentMethod, paymentDetail.serialized, amountPaid, balanceDue, balanceDue > 0 ? "pendiente" : "pagada", req.user.id, now);

    const insertItem = db.prepare(
      `INSERT INTO sales_order_items (id, company_id, sale_id, product_id, product_name, quantity, unit_price, cost_price_at_sale, subtotal, discount, total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertMovement = db.prepare(
      `INSERT INTO inventory_movements (id, company_id, product_id, type, quantity, reference, note, created_by, created_at)
       VALUES (?, ?, ?, 'salida', ?, ?, ?, ?, ?)`
    );
    const updateStock = db.prepare("UPDATE inventory_products SET stock = stock - ?, updated_at = ? WHERE id = ? AND company_id = ?");
    preparedItems.forEach((item) => {
      insertItem.run(randomUUID(), req.user.company_id, saleId, item.product.id, item.product.name, item.quantity, item.unitPrice, item.costPriceAtSale, item.subtotal, item.discount, item.total);
      insertMovement.run(randomUUID(), req.user.company_id, item.product.id, item.quantity, saleCode, "Venta confirmada", req.user.id, now);
      updateStock.run(item.quantity, now, item.product.id, req.user.company_id);
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    return res.status(400).json({ error: error.message || "No se pudo registrar la venta" });
  }
  recordAuditEvent({
    req,
    action: "sale_create",
    entityType: "sale",
    entityId: saleId,
    description: `Registro venta ${saleCode} por ${total}`,
    metadata: { cashSessionId: cashSession.id, itemCount: preparedItems.length, discount }
  });

  res.status(201).json({
    sale: db.prepare("SELECT * FROM sales_orders WHERE id = ?").get(saleId),
    items: db.prepare("SELECT * FROM sales_order_items WHERE sale_id = ?").all(saleId)
  });
});

app.get("/api/ventas/cash", requireAuth, requireSystemAccess("ventas_almacen"), (req, res) => {
  const ownOnly = ventasOwnOnly(req.user.role);
  const activeSession = db
    .prepare(
      `SELECT cash_sessions.*, users.name AS opened_by_name
       FROM cash_sessions
       LEFT JOIN users ON users.id = cash_sessions.opened_by
       WHERE cash_sessions.company_id = ? AND cash_sessions.opened_by = ? AND cash_sessions.status = 'abierta'
       ORDER BY cash_sessions.opened_at DESC LIMIT 1`
    )
    .get(req.user.company_id, req.user.id);
  const movements = activeSession
    ? db
        .prepare(
          `SELECT cash_movements.*, users.name AS created_by_name
           FROM cash_movements
           LEFT JOIN users ON users.id = cash_movements.created_by
           WHERE cash_movements.company_id = ? AND cash_movements.session_id = ?
           ORDER BY cash_movements.created_at DESC`
        )
        .all(req.user.company_id, activeSession.id)
    : [];
  const pendingSales = activeSession
    ? db
        .prepare(
          `SELECT * FROM sales_orders
           WHERE company_id = ? AND status = 'confirmada' AND cash_closed = 0
             AND (cash_session_id = ? OR (cash_session_id = '' AND created_by = ?))
           ORDER BY created_at DESC`
        )
        .all(req.user.company_id, activeSession.id, activeSession.opened_by)
    : db
        .prepare(`SELECT * FROM sales_orders WHERE company_id = ? AND status = 'confirmada' AND cash_closed = 0 ${ownOnly ? "AND created_by = ?" : ""} ORDER BY created_at DESC`)
        .all(...(ownOnly ? [req.user.company_id, req.user.id] : [req.user.company_id]));
  const total = pendingSales.reduce((sum, sale) => sum + payableToCash(sale), 0);
  res.json({ pendingSales, total, activeSession, movements });
});

app.post("/api/ventas/cash/open", requireAuth, requireSystemAccess("ventas_almacen"), requireVentasRole("admin", "ventas_admin", "cajero"), (req, res) => {
  const settings = mapSettings(loadSettings(req.user.company_id));
  const registerNumber = clampNumber(req.body.registerNumber || req.user.cash_register_number, 1, settings.cashRegisterCount || 1, 1);
  const active = db
    .prepare("SELECT id FROM cash_sessions WHERE company_id = ? AND opened_by = ? AND status = 'abierta'")
    .get(req.user.company_id, req.user.id);
  if (active) return res.status(400).json({ error: "Ya tienes una caja abierta" });
  const busyRegister = db
    .prepare("SELECT id FROM cash_sessions WHERE company_id = ? AND register_number = ? AND status = 'abierta'")
    .get(req.user.company_id, registerNumber);
  if (busyRegister) return res.status(400).json({ error: `La caja ${registerNumber} ya esta abierta` });
  const session = {
    id: randomUUID(),
    registerNumber,
    openingAmount: Number(req.body.openingAmount || 0),
    openedAt: new Date().toISOString()
  };
  if (session.openingAmount < 0) return res.status(400).json({ error: "El monto inicial no puede ser negativo" });
  db.prepare(
    `INSERT INTO cash_sessions (id, company_id, opened_by, register_number, opening_amount, status, opened_at)
     VALUES (?, ?, ?, ?, ?, 'abierta', ?)`
  ).run(session.id, req.user.company_id, req.user.id, session.registerNumber, session.openingAmount, session.openedAt);
  recordAuditEvent({ req, action: "cash_open", entityType: "cash_session", entityId: session.id, description: `Abrio caja ${session.registerNumber} con ${session.openingAmount}` });
  res.status(201).json({
    session: db.prepare("SELECT * FROM cash_sessions WHERE id = ?").get(session.id)
  });
});

app.post("/api/ventas/cash/movements", requireAuth, requireSystemAccess("ventas_almacen"), requireVentasRole("admin", "ventas_admin", "cajero"), (req, res) => {
  const session = db
    .prepare("SELECT * FROM cash_sessions WHERE company_id = ? AND opened_by = ? AND status = 'abierta'")
    .get(req.user.company_id, req.user.id);
  if (!session) return res.status(400).json({ error: "Abre caja antes de registrar movimientos" });
  const movement = {
    id: randomUUID(),
    type: String(req.body.type || "ingreso").trim(),
    amount: Number(req.body.amount || 0),
    reason: String(req.body.reason || "").trim(),
    createdAt: new Date().toISOString()
  };
  if (!["ingreso", "egreso"].includes(movement.type) || movement.amount <= 0 || !movement.reason) {
    return res.status(400).json({ error: "Movimiento de caja invalido" });
  }
  db.prepare(
    `INSERT INTO cash_movements (id, company_id, session_id, type, amount, reason, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(movement.id, req.user.company_id, session.id, movement.type, movement.amount, movement.reason, req.user.id, movement.createdAt);
  recordAuditEvent({ req, action: "cash_movement", entityType: "cash_session", entityId: session.id, description: `${movement.type} de caja por ${movement.amount}: ${movement.reason}` });
  res.status(201).json({ movement: db.prepare("SELECT * FROM cash_movements WHERE id = ?").get(movement.id) });
});

app.post("/api/ventas/cash/close", requireAuth, requireSystemAccess("ventas_almacen"), requireVentasRole("admin", "ventas_admin", "cajero"), (req, res) => {
  const session = db
    .prepare("SELECT * FROM cash_sessions WHERE company_id = ? AND opened_by = ? AND status = 'abierta'")
    .get(req.user.company_id, req.user.id);
  if (!session) return res.status(400).json({ error: "No tienes una caja abierta" });
  const pendingSales = db
    .prepare(
      `SELECT * FROM sales_orders
       WHERE company_id = ? AND status = 'confirmada' AND cash_closed = 0
         AND (cash_session_id = ? OR (cash_session_id = '' AND created_by = ?))`
    )
    .all(req.user.company_id, session.id, session.opened_by);
  const now = new Date().toISOString();
  const closureId = randomUUID();
  const code = buildNextCashCode(req.user.company_id, now);
  const total = pendingSales.reduce((sum, sale) => sum + payableToCash(sale), 0);
  const movements = db.prepare("SELECT * FROM cash_movements WHERE company_id = ? AND session_id = ?").all(req.user.company_id, session.id);
  const movementTotal = movements.reduce((sum, item) => sum + (item.type === "ingreso" ? Number(item.amount || 0) : -Number(item.amount || 0)), 0);
  const openingAmount = Number(session.opening_amount || 0);
  const expectedAmount = openingAmount + total + movementTotal;
  const countedAmount = Number(req.body.countedAmount ?? expectedAmount);
  const differenceAmount = countedAmount - expectedAmount;
  if (countedAmount < 0) return res.status(400).json({ error: "El efectivo contado no puede ser negativo" });
  db.exec("BEGIN");
  try {
  db.prepare(
    `INSERT INTO cash_closures (
       id, company_id, code, register_number, opening_amount, total_sales, movement_total, expected_amount,
       counted_amount, difference_amount, sale_count, created_by, created_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(closureId, req.user.company_id, code, Number(session.register_number || 1), openingAmount, total, movementTotal, expectedAmount, countedAmount, differenceAmount, pendingSales.length, req.user.id, now);
  db.prepare("UPDATE sales_orders SET cash_closed = 1 WHERE company_id = ? AND status = 'confirmada' AND cash_closed = 0 AND (cash_session_id = ? OR (cash_session_id = '' AND created_by = ?))").run(req.user.company_id, session.id, session.opened_by);
  db.prepare("UPDATE cash_sessions SET status = 'cerrada', closed_at = ? WHERE id = ? AND company_id = ?").run(now, session.id, req.user.company_id);
  db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    return res.status(400).json({ error: error.message || "No se pudo cerrar la caja" });
  }
  recordAuditEvent({
    req,
    action: "cash_close",
    entityType: "cash_closure",
    entityId: closureId,
    description: `Cerro caja ${session.register_number || 1}. Esperado ${expectedAmount}, contado ${countedAmount}, diferencia ${differenceAmount}`,
    metadata: { saleCount: pendingSales.length, total, movementTotal, openingAmount }
  });
  res.status(201).json({ closure: db.prepare("SELECT * FROM cash_closures WHERE id = ?").get(closureId) });
});

app.get("/api/ventas/cash/history", requireAuth, requireSystemAccess("ventas_almacen"), (req, res) => {
  const ownOnly = ventasOwnOnly(req.user.role);
  const closures = db.prepare(`SELECT * FROM cash_closures WHERE company_id = ? ${ownOnly ? "AND created_by = ?" : ""} ORDER BY created_at DESC`).all(...(ownOnly ? [req.user.company_id, req.user.id] : [req.user.company_id]));
  res.json({ closures });
});

app.post("/api/ventas/products/:id/movements", requireAuth, requireSystemAccess("ventas_almacen"), requireVentasRole("admin", "ventas_admin", "almacen"), (req, res) => {
  const product = db.prepare("SELECT * FROM inventory_products WHERE id = ? AND company_id = ?").get(req.params.id, req.user.company_id);
  if (!product) return res.status(404).json({ error: "Producto no encontrado" });
  const type = String(req.body.type || "entrada");
  const quantity = Number(req.body.quantity || 0);
  if (!["entrada", "salida", "ajuste"].includes(type) || !Number.isFinite(quantity) || quantity < 0 || (type !== "ajuste" && quantity <= 0)) return res.status(400).json({ error: "Movimiento invalido" });
  if (type === "salida" && quantity > Number(product.stock || 0)) return res.status(400).json({ error: "La salida supera el stock disponible" });
  const signedQuantity = type === "ajuste" ? quantity - Number(product.stock || 0) : type === "salida" ? -quantity : quantity;
  const movementQuantity = type === "ajuste" ? signedQuantity : quantity;
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO inventory_movements (id, company_id, product_id, type, quantity, reference, note, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    req.user.company_id,
    product.id,
    type,
    movementQuantity,
    String(req.body.reference || ""),
    String(req.body.note || ""),
    req.user.id,
    now
  );
  db.prepare("UPDATE inventory_products SET stock = ?, updated_at = ? WHERE id = ? AND company_id = ?").run(Math.max(Number(product.stock || 0) + signedQuantity, 0), now, product.id, req.user.company_id);
  recordAuditEvent({
    req,
    action: "stock_movement",
    entityType: "product",
    entityId: product.id,
    description: `${type} de stock para ${product.name}: ${movementQuantity}`,
    metadata: { previousStock: Number(product.stock || 0), nextStock: Math.max(Number(product.stock || 0) + signedQuantity, 0), reference: String(req.body.reference || "") }
  });
  res.json({ product: db.prepare("SELECT * FROM inventory_products WHERE id = ?").get(product.id) });
});

app.get("/api/ventas/products/:id/movements", requireAuth, requireSystemAccess("ventas_almacen"), (req, res) => {
  const product = db.prepare("SELECT id FROM inventory_products WHERE id = ? AND company_id = ?").get(req.params.id, req.user.company_id);
  if (!product) return res.status(404).json({ error: "Producto no encontrado" });
  const movements = db
    .prepare(
      `SELECT inventory_movements.*, users.name AS created_by_name
       FROM inventory_movements
       LEFT JOIN users ON users.id = inventory_movements.created_by
       WHERE inventory_movements.company_id = ? AND inventory_movements.product_id = ?
       ORDER BY inventory_movements.created_at DESC
       LIMIT 30`
    )
    .all(req.user.company_id, product.id);
  res.json({ movements });
});

app.patch("/api/companies/:id/status", requireAuth, requireRole("zow_owner"), (req, res) => {
  const status = String(req.body.status || "").trim();
  if (!["active", "suspended", "cancelled"].includes(status)) return res.status(400).json({ error: "Estado invalido" });
  const company = db.prepare("SELECT id FROM companies WHERE id = ? AND id <> 'zow-internal'").get(req.params.id);
  if (!company) return res.status(404).json({ error: "Empresa no encontrada" });
  db.prepare("UPDATE companies SET status = ?, updated_at = ? WHERE id = ?").run(status, new Date().toISOString(), company.id);
  recordAuditEvent({
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

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Correspondencia ZOW backend listo en http://localhost:${port}`);
  });
}

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
    cashRegisterNumber: Number(user.cash_register_number || 0),
    companyPlan: user.plan || "",
    billingPeriod: user.billing_period || "",
    membershipStartsAt: user.starts_at || "",
    membershipEndsAt: user.ends_at || "",
    companyStatus: user.company_status || ""
  };
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

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
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

function sqlPlaceholders(items) {
  return items.map(() => "?").join(", ");
}

function getDocumentById(id, companyId) {
  return db
    .prepare(
      `SELECT documents.*,
              COALESCE((SELECT COUNT(*) FROM document_files WHERE document_files.company_id = documents.company_id AND document_files.document_id = documents.id), 0) AS digital_file_count,
              COALESCE((SELECT GROUP_CONCAT(original_name, ', ') FROM document_files WHERE document_files.company_id = documents.company_id AND document_files.document_id = documents.id), documents.digital_file_name) AS digital_file_names
       FROM documents
       WHERE documents.id = ? AND documents.company_id = ?`
    )
    .get(id, companyId);
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

function attachUploadedFiles({ files, companyId, documentId, userId, uploadedAt }) {
  if (!files.length) return;
  const insertFile = db.prepare(
    `INSERT INTO document_files (id, company_id, document_id, original_name, stored_name, size, mime_type, uploaded_by, uploaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  files.forEach((file) => {
    insertFile.run(
      randomUUID(),
      companyId,
      documentId,
      file.originalname,
      file.filename,
      file.size || 0,
      file.mimetype || "",
      userId,
      uploadedAt
    );
  });
}

function buildDerivationComment(unitName, comment) {
  const detail = String(comment || "").trim();
  return `Destino: ${unitName}. ${detail || "Sin comentario adicional."}`;
}

function requireSystemAccess(systemId) {
  return (req, res, next) => {
    if (req.user.role === "zow_owner") return res.status(403).json({ error: "El panel ZOW no opera sistemas de empresas" });
    const access = db
      .prepare("SELECT status FROM company_system_access WHERE company_id = ? AND system_id = ?")
      .get(req.user.company_id, systemId);
    if (!access || access.status !== "active") {
      return res.status(403).json({ error: "La empresa no tiene acceso activo a este sistema" });
    }
    next();
  };
}

function requireVentasRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Este rol no tiene permiso para esta funcion de Ventas-Almacen" });
    }
    next();
  };
}

function ventasOwnOnly(role) {
  return !["admin", "ventas_admin", "supervisor"].includes(role);
}

function payableToCash(sale) {
  const detail = parsePaymentDetail(sale.payment_detail);
  if (Object.keys(detail).length) return Math.max(Number(detail.efectivo || 0) - Number(sale.change_amount || 0), 0);
  if (sale.payment_method === "efectivo") return Number(sale.total || 0);
  if (sale.payment_method === "credito") return Number(sale.amount_paid || 0);
  return 0;
}

function parsePaymentDetail(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function normalizePaymentDetail(input, total, paymentMethod) {
  if (paymentMethod !== "mixto") return { detail: {}, serialized: "", totalPaid: Number(total || 0), cash: 0, nonCash: 0 };
  const raw = input && typeof input === "object" ? input : {};
  const detail = {};
  ["efectivo", "tarjeta", "transferencia", "qr"].forEach((method) => {
    detail[method] = Number(Math.max(Number(raw[method] || 0), 0).toFixed(2));
  });
  const totalPaid = Object.values(detail).reduce((sum, amount) => sum + Number(amount || 0), 0);
  if (totalPaid + 0.0001 < Number(total || 0)) throw new Error("El pago mixto no cubre el total de la venta");
  const nonCash = Number(detail.tarjeta || 0) + Number(detail.transferencia || 0) + Number(detail.qr || 0);
  return { detail, serialized: JSON.stringify(detail), totalPaid, cash: Number(detail.efectivo || 0), nonCash };
}

function ensureSaasSystems() {
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
  const upsert = db.prepare(
    `INSERT INTO saas_systems (id, name, slug, description, status)
     VALUES (?, ?, ?, ?, 'active')
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, slug = excluded.slug, description = excluded.description, status = 'active'`
  );
  systems.forEach((system) => upsert.run(system.id, system.name, system.slug, system.description));
}

function loadSettings(companyId) {
  return db.prepare("SELECT * FROM organization_settings WHERE company_id = ? OR id = ? ORDER BY id = ? DESC LIMIT 1").get(companyId, companyId, companyId);
}

function mapSettings(settings = {}) {
  return {
    companyName: settings.company_name || "Empresa sin configurar",
    storeName: settings.store_name || "",
    currency: settings.currency || "BOB",
    taxId: settings.tax_id || "",
    phone: settings.phone || "",
    address: settings.address || "",
    ticketNote: settings.ticket_note || "",
    cashRegisterCount: clampNumber(settings.cash_register_count, 1, 20, 1),
    taxRate: clampDecimal(settings.tax_rate, 0, 100, 0),
    allowCredit: Number(settings.allow_credit ?? 1) === 1,
    allowDiscounts: Number(settings.allow_discounts ?? 1) === 1,
    requireCustomerForSale: Number(settings.require_customer_sale || 0) === 1,
    logoName: settings.logo_name || "",
    logoUrl: settings.logo_path ? `/${settings.logo_path}` : ""
  };
}

function clampNumber(value, min, max, fallback) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(number, min), max);
}

function clampDecimal(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(number, min), max);
}

function buildNextDocumentCode(companyId, year, date = new Date().toISOString()) {
  const month = String(new Date(date).getMonth() + 1).padStart(2, "0");
  const prefix = `${month}-${year}`;
  const rows = db.prepare("SELECT code FROM documents WHERE company_id = ? AND code LIKE ?").all(companyId, `${prefix}-%`);
  const next = rows.reduce((max, row) => {
    const match = String(row.code || "").match(/(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;
  return `${prefix}-${String(next).padStart(4, "0")}`;
}

function buildNextSaleCode(companyId, date = new Date().toISOString()) {
  const year = new Date(date).getFullYear();
  const prefix = `V-${year}`;
  const rows = db.prepare("SELECT code FROM sales_orders WHERE company_id = ? AND code LIKE ?").all(companyId, `${prefix}-%`);
  const next = rows.reduce((max, row) => {
    const match = String(row.code || "").match(/(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;
  return `${prefix}-${String(next).padStart(5, "0")}`;
}

function buildNextCashCode(companyId, date = new Date().toISOString()) {
  const year = new Date(date).getFullYear();
  const prefix = `C-${year}`;
  const rows = db.prepare("SELECT code FROM cash_closures WHERE company_id = ? AND code LIKE ?").all(companyId, `${prefix}-%`);
  const next = rows.reduce((max, row) => {
    const match = String(row.code || "").match(/(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;
  return `${prefix}-${String(next).padStart(5, "0")}`;
}

function buildNextPurchaseCode(companyId, date = new Date().toISOString()) {
  const year = new Date(date).getFullYear();
  const prefix = `P-${year}`;
  const rows = db.prepare("SELECT code FROM purchase_orders WHERE company_id = ? AND code LIKE ?").all(companyId, `${prefix}-%`);
  const next = rows.reduce((max, row) => {
    const match = String(row.code || "").match(/(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;
  return `${prefix}-${String(next).padStart(5, "0")}`;
}

function buildNextSalesReturnCode(companyId, date = new Date().toISOString()) {
  const current = new Date(date);
  const prefix = `DEV-${String(current.getMonth() + 1).padStart(2, "0")}${current.getFullYear()}`;
  const rows = db.prepare("SELECT code FROM sales_returns WHERE company_id = ? AND code LIKE ?").all(companyId, `${prefix}-%`);
  const next = rows.reduce((max, row) => {
    const match = String(row.code || "").match(/(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;
  return `${prefix}-${String(next).padStart(5, "0")}`;
}

function suspendExpiredCompanies() {
  db.prepare(
    `UPDATE companies
     SET status = ?, updated_at = ?
     WHERE status = ?
       AND COALESCE(NULLIF(ends_at, ''), '') <> ''
       AND date(ends_at) < date('now')`
  ).run("suspended", new Date().toISOString(), "active");
}

function recordPublicLookup(req, code, ci, documentItem) {
  db.prepare(
    `INSERT INTO public_lookup_audit (id, company_id, document_id, code, ci_hash, ip_address, user_agent, found, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
  ).run(
    randomUUID(),
    documentItem?.company_id || null,
    documentItem?.id || null,
    code,
    hashLookupValue(ci),
    getRequestIp(req),
    String(req.headers["user-agent"] || "").slice(0, 260),
    documentItem ? 1 : 0
  );
}

function recordAuditEvent({ req, action, entityType = "", entityId = "", description = "", metadata = {} }) {
  db.prepare(
    `INSERT INTO audit_events (id, company_id, actor_user_id, actor_name, action, entity_type, entity_id, description, metadata, ip_address, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
  ).run(
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
  );
}

function recordLeadHistory({ req, leadId, status = "", priority = "", nextAction = "", nextActionAt = "", notes = "", description = "" }) {
  db.prepare(
    `INSERT INTO lead_history (id, lead_id, actor_user_id, actor_name, status, priority, next_action, next_action_at, notes, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), leadId, req.user?.id || null, req.user?.name || "", status, priority, nextAction, nextActionAt, notes, description);
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
