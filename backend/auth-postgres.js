const jwt = require("jsonwebtoken");
const pg = require("./pg");

const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-in-production";
const JWT_ISSUER = "zow-saas";
const JWT_AUDIENCE = "zow-correspondencia";

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, unitId: user.unit_id, companyId: user.company_id }, JWT_SECRET, {
    expiresIn: "8h",
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE
  });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "No autenticado" });

  jwt.verify(token, JWT_SECRET, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE }, async (error, payload) => {
    if (error) return res.status(401).json({ error: "Token invalido" });
    try {
      const user = await pg.get(
        `SELECT users.id, users.company_id, users.name, users.username, users.role, users.unit_id, users.position, units.name AS unit_name,
                companies.status AS company_status, companies.starts_at, companies.ends_at
         FROM users
         JOIN units ON units.id = users.unit_id
         JOIN companies ON companies.id = users.company_id
         WHERE users.id = ? AND users.is_active = true`,
        [payload.sub]
      );
      if (!user) return res.status(401).json({ error: "Sesion invalida" });
      if (isCompanyExpired(user)) {
        await pg.run("UPDATE companies SET status = 'suspended', updated_at = now() WHERE id = ? AND status = 'active'", [user.company_id]);
        return res.status(403).json({ error: "La membresia de la empresa vencio. Contacte a ZOW." });
      }
      if (user.company_status !== "active") return res.status(403).json({ error: "La empresa no esta activa. Contacte a ZOW." });
      req.user = user;
      next();
    } catch {
      return res.status(401).json({ error: "Sesion invalida" });
    }
  });
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Permiso insuficiente" });
    next();
  };
}

async function canSeeDocument(user, document) {
  if (user.role === "zow_owner") return true;
  if (document.company_id && user.company_id && document.company_id !== user.company_id) return false;
  if (user.role === "admin" || user.role === "recepcion_principal") return true;
  if (document.current_unit_id === user.unit_id || document.created_by_unit_id === user.unit_id) return true;
  const recipient = await pg.get("SELECT 1 FROM document_recipients WHERE document_id = ? AND unit_id = ?", [document.id, user.unit_id]);
  return Boolean(recipient);
}

function isCompanyExpired(user) {
  if (!user?.ends_at) return false;
  const end = new Date(`${String(user.ends_at).slice(0, 10)}T23:59:59`);
  return Number.isFinite(end.getTime()) && end < new Date();
}

module.exports = { signToken, requireAuth, requireRole, canSeeDocument };
