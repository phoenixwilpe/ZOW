require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const { randomUUID } = require("node:crypto");
const { createClient } = require("@supabase/supabase-js");
const pg = require("./pg");
const { signToken, requireAuth, requireRole, canSeeDocument } = require("./auth-postgres");
const {
  applySecurity,
  corsOptions,
  getLoginStatus,
  recordLoginFailure,
  clearLoginFailures,
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
const enabledPanelSystemIds = process.env.ENABLE_VENTAS_SAAS === "true" ? ["correspondencia", "ventas_almacen"] : ["correspondencia"];
const showVentasSaas = process.env.ENABLE_VENTAS_SAAS === "true";

app.use(cors(corsOptions()));
applySecurity(app, express);
app.use(express.static(require("node:path").join(__dirname, "..")));

app.get("/api/health", async (_req, res) => {
  await pg.get("SELECT 1 AS ok");
  res.json({ ok: true, database: "postgres" });
});

app.post("/api/auth/login", async (req, res) => {
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
    return res.status(401).json({ error: "Usuario o contrasena incorrectos" });
  }
  const company = await pg.get("SELECT status FROM companies WHERE id = ?", [user.company_id]);
  if (!company || company.status !== "active") return res.status(403).json({ error: "La empresa no esta activa. Contacte a ZOW." });
  clearLoginFailures(loginStatus.key);

  const publicData = await pg.get(
    `SELECT users.id, users.company_id, users.name, users.username, users.role, users.unit_id, users.position, users.ci, users.phone,
            units.name AS unit_name, companies.name AS company_name
     FROM users
     JOIN units ON units.id = users.unit_id
     JOIN companies ON companies.id = users.company_id
     WHERE users.id = ?`,
    [user.id]
  );
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
  res.status(201).json({ user });
});

app.patch("/api/users/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const existing = await pg.get("SELECT id, username, role, unit_id, is_protected FROM users WHERE id = ? AND company_id = ?", [req.params.id, req.user.company_id]);
  if (!existing) return res.status(404).json({ error: "Usuario no encontrado" });
  const user = readUserPayload(req.body);
  user.password = String(req.body.password || "").trim();
  if (!user.name || !user.username || !user.unitId) return res.status(400).json({ error: "Nombre, usuario y unidad son obligatorios" });
  if (!USER_ROLES.has(user.role)) return res.status(400).json({ error: "Rol invalido" });
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
  res.json({ user: await pg.get("SELECT id, company_id, name, username, role, unit_id, position, ci, phone, is_active, is_protected FROM users WHERE id = ?", [existing.id]) });
});

app.patch("/api/users/:id/status", requireAuth, requireRole("admin"), async (req, res) => {
  const user = await pg.get("SELECT id, is_protected FROM users WHERE id = ? AND company_id = ?", [req.params.id, req.user.company_id]);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
  if (user.is_protected) return res.status(400).json({ error: "No se puede desactivar un usuario protegido" });
  await pg.run("UPDATE users SET is_active = ? WHERE id = ?", [Boolean(req.body.active), user.id]);
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
  res.json({ document: await getDocumentById(doc.id, req.user.company_id) });
});

app.patch("/api/documents/:id/physical-received", requireAuth, async (req, res) => {
  const doc = await pg.get("SELECT * FROM documents WHERE id = ? AND company_id = ?", [req.params.id, req.user.company_id]);
  if (!doc) return res.status(404).json({ error: "Documento no encontrado" });
  if (!(await canSeeDocument(req.user, doc))) return res.status(403).json({ error: "Permiso insuficiente" });
  const now = new Date().toISOString();
  const status = doc.status === "Reservado" ? "Recibido" : doc.status;
  await pg.run("UPDATE documents SET physical_received = true, status = ?, updated_at = ? WHERE id = ?", [status, now, doc.id]);
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

app.post("/api/companies", requireAuth, requireRole("zow_owner"), async (req, res) => {
  const now = new Date().toISOString();
  const company = {
    id: randomUUID(),
    name: String(req.body.name || "").trim(),
    slug: slugify(req.body.slug || req.body.name),
    plan: String(req.body.plan || "basico"),
    status: String(req.body.status || "active"),
    maxUsers: Number(req.body.maxUsers || 10),
    maxUnits: Number(req.body.maxUnits || 10),
    storageMb: Number(req.body.storageMb || 1024),
    contactName: String(req.body.contactName || "").trim(),
    contactEmail: String(req.body.contactEmail || "").trim(),
    contactPhone: String(req.body.contactPhone || "").trim(),
    startsAt: String(req.body.startsAt || ""),
    endsAt: String(req.body.endsAt || ""),
    adminName: String(req.body.adminName || "Encargado de Sistema").trim(),
    adminUsername: normalizeUsername(req.body.adminUsername),
    adminPassword: String(req.body.adminPassword || "").trim(),
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
      `INSERT INTO companies (id, name, slug, plan, status, max_users, max_units, storage_mb, contact_name, contact_email, contact_phone, starts_at, ends_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?::company_status, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [company.id, company.name, company.slug, company.plan, company.status || "active", company.maxUsers, company.maxUnits, company.storageMb, company.contactName, company.contactEmail, company.contactPhone, company.startsAt, company.endsAt, now, now]
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
  });
  res.status(201).json({ company: await pg.get("SELECT * FROM companies WHERE id = ?", [company.id]), adminUser: { id: adminUserId, username: company.adminUsername, name: company.adminName } });
});

app.patch("/api/companies/:id", requireAuth, requireRole("zow_owner"), async (req, res) => {
  const existing = await pg.get("SELECT id FROM companies WHERE id = ? AND id <> 'zow-internal'", [req.params.id]);
  if (!existing) return res.status(404).json({ error: "Empresa no encontrada" });
  const now = new Date().toISOString();
  const company = {
    name: String(req.body.name || "").trim(),
    slug: slugify(req.body.slug || req.body.name),
    plan: String(req.body.plan || "basico"),
    status: String(req.body.status || "active"),
    maxUsers: Number(req.body.maxUsers || 10),
    maxUnits: Number(req.body.maxUnits || 10),
    storageMb: Number(req.body.storageMb || 1024),
    contactName: String(req.body.contactName || "").trim(),
    contactEmail: String(req.body.contactEmail || "").trim(),
    contactPhone: String(req.body.contactPhone || "").trim(),
    startsAt: String(req.body.startsAt || "").trim(),
    endsAt: String(req.body.endsAt || "").trim(),
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
       SET name = ?, slug = ?, plan = ?, status = ?::company_status, max_users = ?, max_units = ?, storage_mb = ?,
           contact_name = ?, contact_email = ?, contact_phone = ?, starts_at = ?, ends_at = ?, updated_at = ?
       WHERE id = ?`,
      [
        company.name,
        company.slug,
        company.plan,
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
  res.json({ ok: true });
});

app.get("/api/systems", requireAuth, requireRole("zow_owner"), async (_req, res) => {
  res.json({ systems: await pg.all("SELECT * FROM saas_systems WHERE id = ANY(?::text[]) ORDER BY name", [enabledPanelSystemIds]) });
});

app.get("/api/companies/:id/systems", requireAuth, requireRole("zow_owner"), async (req, res) => {
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
  res.json({ ok: true });
});

app.patch("/api/companies/:id/status", requireAuth, requireRole("zow_owner"), async (req, res) => {
  const status = String(req.body.status || "").trim();
  if (!["active", "suspended", "cancelled"].includes(status)) return res.status(400).json({ error: "Estado invalido" });
  const company = await pg.get("SELECT id FROM companies WHERE id = ? AND id <> 'zow-internal'", [req.params.id]);
  if (!company) return res.status(404).json({ error: "Empresa no encontrada" });
  await pg.run("UPDATE companies SET status = ?::company_status, updated_at = now() WHERE id = ?", [status, company.id]);
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
    name: user.name,
    username: user.username,
    role: user.role,
    unitId: user.unit_id,
    unitName: user.unit_name,
    position: user.position,
    ci: user.ci || "",
    phone: user.phone || ""
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
