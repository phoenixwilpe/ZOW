const bcrypt = require("bcryptjs");

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 6;
const loginAttempts = new Map();
const dummyPasswordHash = bcrypt.hashSync("zow-invalid-password-placeholder", 12);

function applySecurity(app, express) {
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "img-src 'self' data: blob:",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "connect-src 'self' https://*.supabase.co"
      ].join("; ")
    );
    if (req.secure || req.headers["x-forwarded-proto"] === "https") {
      res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
    }
    next();
  });

  app.use(express.json({ limit: "200kb" }));
}

function corsOptions() {
  const configuredOrigins = String(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigins = new Set([
    "http://localhost:4173",
    "http://localhost:4174",
    "http://127.0.0.1:4173",
    "http://127.0.0.1:4174",
    "https://zow-six.vercel.app",
    ...configuredOrigins
  ]);

  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin) || /^https:\/\/zow[-\w]*\.vercel\.app$/.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Origen no permitido por ZOW"));
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400
  };
}

function getLoginStatus(req, username) {
  const key = loginKey(req, username);
  const entry = loginAttempts.get(key);
  if (!entry) return { allowed: true, key };

  const now = Date.now();
  if (entry.lockedUntil && entry.lockedUntil > now) {
    return { allowed: false, key, retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000) };
  }
  if (entry.firstAttemptAt + LOGIN_WINDOW_MS < now) {
    loginAttempts.delete(key);
    return { allowed: true, key };
  }
  return { allowed: true, key };
}

function recordLoginFailure(key) {
  const now = Date.now();
  const current = loginAttempts.get(key);
  const entry =
    current && current.firstAttemptAt + LOGIN_WINDOW_MS >= now
      ? current
      : { count: 0, firstAttemptAt: now, lockedUntil: 0 };

  entry.count += 1;
  if (entry.count >= LOGIN_MAX_ATTEMPTS) entry.lockedUntil = now + LOGIN_LOCK_MS;
  loginAttempts.set(key, entry);
  return entry;
}

function clearLoginFailures(key) {
  loginAttempts.delete(key);
}

function safePasswordCompare(password, hash) {
  return bcrypt.compareSync(String(password || ""), hash || dummyPasswordHash);
}

function validatePasswordStrength(password) {
  const value = String(password || "");
  if (value.length < 10) return "La contrasena debe tener al menos 10 caracteres.";
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value)) return "La contrasena debe combinar mayusculas y minusculas.";
  if (!/\d/.test(value)) return "La contrasena debe incluir al menos un numero.";
  if (!/[^A-Za-z0-9]/.test(value)) return "La contrasena debe incluir al menos un simbolo.";
  return "";
}

function loginKey(req, username) {
  const ip = String(req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
  return `${ip}:${String(username || "").toLowerCase()}`;
}

module.exports = {
  applySecurity,
  corsOptions,
  getLoginStatus,
  recordLoginFailure,
  clearLoginFailures,
  safePasswordCompare,
  validatePasswordStrength
};
