const http = require('http');
const url = require('url');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

module.exports = async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname.replace(/^\/+|\/+$/g, '');

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (path === 'api/health' || path === 'health') {
    try {
      const result = await pool.query('SELECT NOW()');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', database: 'connected', time: result.rows[0].now }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', message: err.message }));
    }
    return;
  }

  // Default 404
  res.writeHead(404);
  res.end('Not Found');
};
