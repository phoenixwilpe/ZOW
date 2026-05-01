const jwt = require("jsonwebtoken");
const pg = require("./pg");

const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-in-production";

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, unitId: user.unit_id, companyId: user.company_id }, JWT_SECRET, { expiresIn: "8h" });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "No autenticado" });

  jwt.verify(token, JWT_SECRET, async (error, payload) => {
    if (error) return res.status(401).json({ error: "Token invalido" });
    try {
      const user = await pg.get(
        `SELECT users.id, users.company_id, users.name, users.username, users.role, users.unit_id, users.position, units.name AS unit_name
         FROM users
         JOIN units ON units.id = users.unit_id
         WHERE users.id = ? AND users.is_active = true`,
        [payload.sub]
      );
      if (!user) return res.status(401).json({ error: "Sesion invalida" });
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

module.exports = { signToken, requireAuth, requireRole, canSeeDocument };
