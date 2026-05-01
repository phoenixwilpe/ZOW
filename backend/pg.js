const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false }
});

function toPgSql(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

async function all(sql, params = []) {
  const result = await pool.query(toPgSql(sql), params);
  return result.rows;
}

async function get(sql, params = []) {
  const result = await pool.query(toPgSql(sql), params);
  return result.rows[0] || null;
}

async function run(sql, params = []) {
  const result = await pool.query(toPgSql(sql), params);
  return result;
}

async function tx(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const scoped = {
      all: async (sql, params = []) => (await client.query(toPgSql(sql), params)).rows,
      get: async (sql, params = []) => (await client.query(toPgSql(sql), params)).rows[0] || null,
      run: async (sql, params = []) => client.query(toPgSql(sql), params)
    };
    const result = await callback(scoped);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { all, get, run, tx, pool };
