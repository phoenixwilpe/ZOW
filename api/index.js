const shouldUseSqlite = process.env.DATABASE_PROVIDER === "sqlite";
const shouldUsePostgres = process.env.DATABASE_PROVIDER === "postgres" || Boolean(process.env.VERCEL);

const app = shouldUsePostgres && !shouldUseSqlite
  ? require("../backend/server-postgres")
  : require("../backend/server");

module.exports = app;
