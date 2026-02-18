const { pool } = require('../lib/db');
const requestHandler = require('../index.js');

module.exports = async (req, res) => {
  // Adicionar suporte a health check rápido para o Vercel
  if (req.url.endsWith('/health')) {
    try {
      const result = await pool.query('SELECT NOW()');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'ok', 
        database: 'connected', 
        time: result.rows[0].now,
        environment: 'vercel-serverless'
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', message: err.message }));
    }
    return;
  }

  // Chamar o handler principal do projeto
  return requestHandler(req, res);
};
