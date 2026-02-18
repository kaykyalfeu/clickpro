const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Helper to simulate better-sqlite3 API for minimal changes in index.js
const db = {
  prepare: (sql) => {
    // Convert SQLite syntax to PostgreSQL if necessary
    let pgSql = sql
      .replace(/\?/g, (match, offset, string) => {
        let count = (string.substring(0, offset).match(/\?/g) || []).length + 1;
        return '$' + count;
      })
      .replace(/lastInsertRowid/g, 'id') // PostgreSQL uses RETURNING id
      .replace(/datetime\('now'\)/gi, 'CURRENT_TIMESTAMP')
      .replace(/strftime\('%Y-%m-%d', 'now'\)/gi, "TO_CHAR(CURRENT_TIMESTAMP, 'YYYY-MM-DD')");

    return {
      get: async (...params) => {
        const res = await pool.query(pgSql, params);
        return res.rows[0];
      },
      all: async (...params) => {
        const res = await pool.query(pgSql, params);
        return res.rows;
      },
      run: async (...params) => {
        const res = await pool.query(pgSql, params);
        return { lastInsertRowid: res.rows[0]?.id };
      },
      exec: async (sql) => {
        return await pool.query(sql);
      }
    };
  },
  exec: async (sql) => {
    return await pool.query(sql);
  },
  pragma: () => {} // No-op for PostgreSQL
};

function initDb() {
  // In PostgreSQL, tables should be created via migrations or manually.
  // For now, we assume they exist or we can try to create them.
  // But in serverless, we don't want to do this on every request.
  return db;
}

module.exports = {
  initDb,
  pool
};
