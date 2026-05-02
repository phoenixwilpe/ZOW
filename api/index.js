const shouldUseSqlite = process.env.DATABASE_PROVIDER === "sqlite";
const shouldUsePostgres = process.env.DATABASE_PROVIDER === "postgres" || Boolean(process.env.VERCEL);
const missingPostgresConfig = shouldUsePostgres && !shouldUseSqlite && !process.env.DATABASE_URL;

let app;

if (missingPostgresConfig) {
  const express = require("express");
  app = express();
  app.use("/api", (_req, res) => {
    res.status(503).json({
      error: "Falta configurar DATABASE_URL en Vercel para conectar Supabase/PostgreSQL."
    });
  });
} else {
  app = shouldUsePostgres && !shouldUseSqlite
    ? require("../backend/server-postgres")
    : require("../backend/server");
}

module.exports = app;
