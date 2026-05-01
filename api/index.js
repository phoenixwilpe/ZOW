const app =
  process.env.DATABASE_PROVIDER === "postgres"
    ? require("../backend/server-postgres")
    : require("../backend/server");

module.exports = app;
