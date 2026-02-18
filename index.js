/*
 * ClikPro WhatsApp Local Integration
 *
 * Este servidor Node.js expõe um webhook para a API oficial do WhatsApp
 * e permite que você envie e receba mensagens localmente. Um fluxo
 * simples de IA é aplicado para responder automaticamente aos
 * usuários. Para funcionalidades mais avançadas (como criação de leads
 * ou integração com modelos de IA externos), consulte os módulos
 * originais do repositório e adapte conforme necessário.
 */

const http = require('http');
const url = require('url');
const fs = require('fs');
const configStore = require('./lib/config-store');
const auth = require('./lib/auth');
const { initDb } = require('./lib/db');
const jwt = require('./lib/jwt');
const { hashPassword, verifyPassword } = require('./lib/password');
const { encryptSecret, decryptSecret } = require('./lib/secret-store');
const { parseCsv, parseExcel, normalizePhone } = require('./lib/csv');

// Utiliza a API fetch nativa do Node 18+. A versão mínima suportada é
// Node.js 18, que já possui `global.fetch`. Se estiver em uma versão
// anterior, atualize seu Node. Não são necessárias dependências extras.

const fetch = global.fetch;

configStore.ensureDirectories();
auth.ensureAuthStore();
const db = initDb();

function nowIso() {
  return new Date().toISOString();
}

// Armazena as mensagens em memória. Cada item possui:
// {
//   role: 'user' | 'ai' | 'agent',
//   content: string,
//   phone: string
// }
const messages = [];

function parseMultipartFormData(body, boundary) {
  const result = { fields: {}, files: [] };
  const boundaryText = `--${boundary}`;
  const parts = body.split(boundaryText).slice(1, -1);
  parts.forEach((part) => {
    const cleaned = part.trim();
    if (!cleaned) {
      return;
    }
    const [rawHeaders, ...rest] = cleaned.split('\r\n\r\n');
    if (!rawHeaders || !rest.length) {
      return;
    }
    const content = rest.join('\r\n\r\n').replace(/\r\n$/, '');
    const headerLines = rawHeaders.split('\r\n');
    const headers = headerLines.reduce((acc, line) => {
      const [name, value] = line.split(': ');
      if (name && value) {
        acc[name.toLowerCase()] = value;
      }
      return acc;
    }, {});
    const disposition = headers['content-disposition'] || '';
    const nameMatch = disposition.match(/name="([^"]+)"/);
    const filenameMatch = disposition.match(/filename="([^"]+)"/);
    const fieldName = nameMatch ? nameMatch[1] : '';
    if (!fieldName) {
      return;
    }
    if (filenameMatch) {
      result.files.push({
        field: fieldName,
        name: filenameMatch[1],
        type: headers['content-type'] || 'application/octet-stream',
      });
    } else {
      result.fields[fieldName] = content;
    }
  });
  return result;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function parseCookies(cookieHeader) {
  if (!cookieHeader) {
    return {};
  }
  return cookieHeader.split(';').reduce((acc, pair) => {
    const [key, value] = pair.trim().split('=');
    if (key) {
      acc[key] = decodeURIComponent(value || '');
    }
    return acc;
  }, {});
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function requireAuth(req, res) {
  const cookies = parseCookies(req.headers.cookie || '');
  const session = auth.getSession(cookies.session);
  if (!session) {
    sendJson(res, 401, { error: 'Não autenticado' });
    return null;
  }
  return session;
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer (.+)$/i);
  return match ? match[1] : '';
}

function requireJwt(req, res, roles = []) {
  const token = getBearerToken(req);
  const payload = jwt.verify(token);
  if (!payload) {
    sendJson(res, 401, { error: 'Token inválido.' });
    return null;
  }
  if (roles.length && !roles.includes(payload.role)) {
    sendJson(res, 403, { error: 'Sem permissão.' });
    return null;
  }
  return payload;
}

async function getClientMembership(userId, clientId) {
  return await db
    .prepare('SELECT role FROM client_members WHERE user_id = ? AND client_id = ?')
    .get(userId, clientId);
}

async function requireClientAccess(user, clientId) {
  if (!user) {
    return false;
  }
  if (user.role === 'SUPER_ADMIN') {
    return true;
  }
  const membership = await getClientMembership(user.userId, clientId);
  return Boolean(membership);
}

async function requireClientRole(user, clientId, roles) {
  if (!user) {
    return false;
  }
  if (user.role === 'SUPER_ADMIN') {
    return true;
  }
  const membership = await getClientMembership(user.userId, clientId);
  if (!membership) {
    return false;
  }
  return roles.includes(membership.role);
}

async function getClientByPhoneNumberId(phoneNumberId) {
  return await db
    .prepare(
      `SELECT c.id, c.name, c.ai_enabled
       FROM whatsapp_credentials wc
       JOIN clients c ON c.id = wc.client_id
       WHERE wc.phone_number_id = ?`,
    )
    .get(phoneNumberId);
}

async function getOpenAiCredentials(clientId) {
  const row = await db
    .prepare('SELECT api_key_enc, assistant_id, command_prompt FROM openai_credentials WHERE client_id = ?')
    .get(clientId);
  if (!row) {
    return null;
  }
  return {
    apiKey: decryptSecret(row.api_key_enc),
    assistantId: row.assistant_id,
    commandPrompt: row.command_prompt,
  };
}

async function getWhatsappCredentials(clientId) {
  const row = await db
    .prepare('SELECT token_enc, phone_number_id, cloud_number, business_id FROM whatsapp_credentials WHERE client_id = ?')
    .get(clientId);
  if (!row) {
    return null;
  }
  return {
    token: decryptSecret(row.token_enc),
    phoneNumberId: row.phone_number_id,
    cloudNumber: row.cloud_number || '',
    businessId: row.business_id || '',
  };
}

async function logWebhookEvent(clientId, eventType, payload) {
  await db.prepare(
    'INSERT INTO webhook_events (client_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?)',
  ).run(clientId, eventType, JSON.stringify(payload || {}), nowIso());
}

async function logAudit(action, { clientId = null, userId = null, metadata = {} } = {}) {
  await db.prepare(
    'INSERT INTO audit_logs (client_id, user_id, action, metadata_json, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(clientId, userId, action, JSON.stringify(metadata), nowIso());
}

async function ensureContact(clientId, phone) {
  const normalized = normalizePhone(phone);
  const existing = await db
    .prepare('SELECT * FROM contacts WHERE client_id = ? AND phone = ?')
    .get(clientId, normalized);
  if (existing) {
    return existing;
  }
  const info = await db
    .prepare('INSERT INTO contacts (client_id, name, phone, email, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(clientId, '', normalized, '', nowIso());
  return await db.prepare('SELECT * FROM contacts WHERE id = ?').get(info.lastInsertRowid);
}

async function logMessage(clientId, contactId, direction, content, source, status) {
  await db.prepare(
    'INSERT INTO messages (client_id, contact_id, direction, content, source, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(clientId, contactId, direction, content, source, status, nowIso());
}

async function isOptedOut(clientId, phone) {
  const normalized = normalizePhone(phone);
  const row = await db.prepare('SELECT id FROM opt_outs WHERE client_id = ? AND phone = ?').get(clientId, normalized);
  return Boolean(row);
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function canUseAi(clientId) {
  const client = await db
    .prepare('SELECT ai_daily_limit FROM clients WHERE id = ?')
    .get(clientId);
  if (!client || !client.ai_daily_limit) {
    return false;
  }
  const today = getTodayKey();
  const usage = await db
    .prepare('SELECT request_count FROM ai_usage WHERE client_id = ? AND usage_date = ?')
    .get(clientId, today);
  return (usage?.request_count || 0) < client.ai_daily_limit;
}

async function recordAiUsage(clientId) {
  const today = getTodayKey();
  await db.prepare(
    `INSERT INTO ai_usage (client_id, usage_date, request_count, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(client_id, usage_date)
     DO UPDATE SET request_count = ai_usage.request_count + 1`,
  ).run(clientId, today, 1, nowIso());
}

async function canSendForTier(clientId) {
  const client = await db
    .prepare('SELECT meta_tier_limit FROM clients WHERE id = ?')
    .get(clientId);
  if (!client || !client.meta_tier_limit) {
    return false;
  }
  const today = getTodayKey();
  const sent = await db
    .prepare(
      `SELECT COUNT(*) as total
       FROM messages
       WHERE client_id = ?
         AND direction = 'OUTBOUND'
         AND created_at >= ?`,
    )
    .get(clientId, `${today}T00:00:00.000Z`);
  return (sent?.total || 0) < client.meta_tier_limit;
}

/**
 * Resolve o Phone Number ID via Graph API usando o WABA (Business ID).
 * Chama GET /v19.0/<wabaId>/phone_numbers e retorna o primeiro phone_number_id.
 *
 * @param {{ wabaId: string, accessToken: string }} params
 * @returns {Promise<string>} O phone_number_id resolvido.
 */
async function resolveWhatsAppPhoneNumberId({ wabaId, accessToken }) {
  if (!wabaId || !accessToken) {
    throw new Error('wabaId e accessToken são obrigatórios para resolver o Phone Number ID.');
  }
  const response = await fetch(
    `https://graph.facebook.com/v19.0/${wabaId}/phone_numbers`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Falha ao buscar phone numbers via WABA.');
  }
  if (!data.data || data.data.length === 0) {
    throw new Error('Nenhum número de telefone encontrado na conta WABA.');
  }
  return data.data[0].id;
}

/**
 * Envia uma mensagem para um telefone via API do WhatsApp Cloud.
 *
 * @param {string} phone Telefone do destinatário.
 * @param {string} text Conteúdo da mensagem.
 * @param {{ token: string, phoneNumberId: string, businessId: string }} config Credenciais.
 */
async function sendWhatsAppMessage(phone, text, config) {
  if (!config?.token || !config?.phoneNumberId) {
    console.error('[WhatsApp] Credenciais ausentes para envio.');
    return;
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v19.0/${config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.token}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phone,
          type: 'text',
          text: { body: text },
        }),
      },
    );

    const data = await response.json();
    if (!response.ok) {
      console.error('[WhatsApp] Erro ao enviar:', data);
    } else {
      console.log('[WhatsApp] Mensagem enviada com sucesso:', data.messages[0].id);
    }
  } catch (error) {
    console.error('[WhatsApp] Falha na requisição:', error);
  }
}

/**
 * Gera uma resposta usando a API da OpenAI (Assistant).
 *
 * @param {string} clientId ID do cliente.
 * @param {string} text Mensagem do usuário.
 * @param {{ apiKey: string, assistantId: string, commandPrompt: string }} config Credenciais.
 * @returns {Promise<string>} Resposta gerada.
 */
async function generateAIResponse(clientId, text, config) {
  if (!config?.apiKey || !config?.assistantId) {
    return '';
  }

  try {
    // 1. Criar uma Thread
    const threadResponse = await fetch('https://api.openai.com/v1/threads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
        'OpenAI-Beta': 'assistants=v1',
      },
    });
    const thread = await threadResponse.json();

    // 2. Adicionar Mensagem
    await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
        'OpenAI-Beta': 'assistants=v1',
      },
      body: JSON.stringify({
        role: 'user',
        content: text,
      }),
    });

    // 3. Executar o Assistant
    const runResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
        'OpenAI-Beta': 'assistants=v1',
      },
      body: JSON.stringify({
        assistant_id: config.assistantId,
        instructions: config.commandPrompt,
      }),
    });
    const run = await runResponse.json();

    // 4. Aguardar Conclusão (Polling simples)
    let status = run.status;
    while (status === 'queued' || status === 'in_progress') {
      await new Promise((r) => setTimeout(r, 1000));
      const checkResponse = await fetch(
        `https://api.openai.com/v1/threads/${thread.id}/runs/${run.id}`,
        {
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'OpenAI-Beta': 'assistants=v1',
          },
        },
      );
      const check = await checkResponse.json();
      status = check.status;
    }

    // 5. Listar Mensagens e pegar a última da IA
    if (status === 'completed') {
      const messagesResponse = await fetch(
        `https://api.openai.com/v1/threads/${thread.id}/messages`,
        {
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'OpenAI-Beta': 'assistants=v1',
          },
        },
      );
      const list = await messagesResponse.json();
      const lastMessage = list.data.find((m) => m.role === 'assistant');
      return lastMessage?.content[0]?.text?.value || '';
    }
  } catch (error) {
    console.error('[OpenAI] Erro:', error);
  }

  return '';
}

/**
 * Trata uma mensagem recebida pelo webhook. Atualiza o histórico
 * e envia uma resposta automática via WhatsApp.
 *
 * @param {string} phone Identificador do usuário/telefone.
 * @param {string} text Conteúdo da mensagem do usuário.
 */
async function handleIncomingMessage(clientId, phone, text) {
  const normalizedPhone = normalizePhone(phone);
  messages.push({ role: 'user', content: text, phone: normalizedPhone });

  const contact = await ensureContact(clientId, normalizedPhone);
  await logMessage(clientId, contact.id, 'INBOUND', text, 'WEBHOOK', 'RECEIVED');

  if (await isOptedOut(clientId, normalizedPhone)) {
    return;
  }

  const client = await db.prepare('SELECT ai_enabled FROM clients WHERE id = ?').get(clientId);
  let aiResponse = '';

  if (client && client.ai_enabled) {
    const openAiConfig = await getOpenAiCredentials(clientId);
    aiResponse = await generateAIResponse(clientId, text, openAiConfig);
    if (aiResponse) {
      await recordAiUsage(clientId);
    }
  }

  if (!aiResponse) {
    aiResponse = 'Obrigado pela mensagem! Em breve um de nossos consultores entrará em contato.';
  }

  messages.push({ role: 'ai', content: aiResponse, phone: normalizedPhone });
  await logMessage(clientId, contact.id, 'OUTBOUND', aiResponse, 'AI', 'QUEUED');

  const whatsappConfig = await getWhatsappCredentials(clientId);
  if (!(await canSendForTier(clientId))) {
    await logAudit('whatsapp.tier_blocked', {
      clientId,
      metadata: { phone: normalizedPhone },
    });
    return;
  }

  await sendWhatsAppMessage(normalizedPhone, aiResponse, {
    token: whatsappConfig?.token,
    phoneNumberId: whatsappConfig?.phoneNumberId,
    businessId: whatsappConfig?.businessId,
  });
}

/**
 * Servidor HTTP principal. Trata requisições de webhook e interface web.
 */
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname.replace(/^\/+|\/+$/g, '');

  // --- CORS: allow portal to make cross-origin requests ---
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
  const origin = req.headers.origin || '';
  if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-request-id, x-forwarded-host');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- Health check ---
  if (req.method === 'GET' && (path === 'api/health' || path === 'health')) {
    const userCount = await db.prepare('SELECT COUNT(*) as total FROM users').get();
    const clientCount = await db.prepare('SELECT COUNT(*) as total FROM clients').get();
    sendJson(res, 200, {
      status: 'ok',
      service: 'clickpro-backend',
      timestamp: nowIso(),
      database: 'postgresql',
      counts: {
        users: userCount?.total || 0,
        clients: clientCount?.total || 0,
      },
    });
    return;
  }

  // Servir a interface de chat em /
  if (req.method === 'GET' && path === '') {
    try {
      const html = fs.readFileSync(__dirname + '/index.html');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch (err) {
      res.writeHead(500);
      res.end('Erro ao carregar interface');
    }
    return;
  }

  if (req.method === 'GET' && path === 'api/auth/status') {
    sendJson(res, 200, { needsSetup: !auth.isSetup() });
    return;
  }

  if (req.method === 'POST' && path === 'api/admin/seed') {
    readBody(req)
      .then(async (body) => {
        const payload = JSON.parse(body || '{}');
        const existing = await db.prepare('SELECT COUNT(*) as total FROM users').get();
        if (existing.total > 0) {
          sendJson(res, 400, { error: 'Seed já realizado.' });
          return;
        }
        if (!payload.email || !payload.password || !payload.clientName) {
          sendJson(res, 400, { error: 'Informe email, password e clientName.' });
          return;
        }
        const userId = (await db
          .prepare('INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, ?, ?) RETURNING id')
          .run(payload.email, hashPassword(payload.password), 'SUPER_ADMIN', nowIso())).lastInsertRowid;
        const clientId = (await db
          .prepare('INSERT INTO clients (name, ai_enabled, created_at) VALUES (?, ?, ?) RETURNING id')
          .run(payload.clientName, 1, nowIso())).lastInsertRowid;
        await db.prepare(
          'INSERT INTO client_members (client_id, user_id, role, created_at) VALUES (?, ?, ?, ?)',
        ).run(clientId, userId, 'CLIENT_ADMIN', nowIso());
        sendJson(res, 200, { ok: true, userId, clientId });
      })
      .catch((error) => {
        console.error('[ADMIN] Falha no seed:', error);
        sendJson(res, 400, { error: 'Falha ao inicializar.' });
      });
    return;
  }

  if (req.method === 'POST' && path === 'api/auth/jwt/login') {
    readBody(req)
      .then(async (body) => {
        const payload = JSON.parse(body || '{}');
        const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(payload.email);
        if (!user || !verifyPassword(payload.password || '', user.password_hash)) {
          sendJson(res, 401, { error: 'Credenciais inválidas.' });
          return;
        }
        const token = jwt.sign({ userId: user.id, role: user.role, email: user.email });
        await logAudit('auth.login', { userId: user.id });
        sendJson(res, 200, { token });
      })
      .catch((error) => {
        console.error('[AUTH] Falha ao gerar JWT:', error);
        sendJson(res, 400, { error: 'Falha ao autenticar.' });
      });
    return;
  }

  if (req.method === 'GET' && path === 'api/auth/me') {
    const user = requireJwt(req, res);
    if (!user) {
      return;
    }
    sendJson(res, 200, user);
    return;
  }

  if (req.method === 'POST' && path === 'api/auth/setup') {
    readBody(req)
      .then((body) => {
        const payload = JSON.parse(body || '{}');
        auth.setupPassword({ password: payload.password, email: payload.email });
        const token = auth.createSession();
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Set-Cookie': `session=${token}; HttpOnly; Path=/; Max-Age=86400`,
        });
        res.end(JSON.stringify({ ok: true }));
      })
      .catch((error) => {
        console.error('[AUTH] Erro ao configurar senha:', error);
        sendJson(res, 400, { error: 'Não foi possível configurar a senha.' });
      });
    return;
  }

  if (req.method === 'POST' && path === 'api/auth/login') {
    readBody(req)
      .then((body) => {
        const payload = JSON.parse(body || '{}');
        if (!auth.verifyPassword(payload.password)) {
          sendJson(res, 401, { error: 'Senha inválida.' });
          return;
        }
        const token = auth.createSession();
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Set-Cookie': `session=${token}; HttpOnly; Path=/; Max-Age=86400`,
        });
        res.end(JSON.stringify({ ok: true }));
      })
      .catch((error) => {
        console.error('[AUTH] Erro ao autenticar:', error);
        sendJson(res, 400, { error: 'Não foi possível autenticar.' });
      });
    return;
  }

  if (req.method === 'GET' && path === 'api/clients') {
    const user = requireJwt(req, res, ['SUPER_ADMIN']);
    if (!user) {
      return;
    }
    const clients = await db.prepare('SELECT id, name, ai_enabled, created_at FROM clients').all();
    sendJson(res, 200, { clients });
    return;
  }

  if (req.method === 'GET' && path.startsWith('api/clients/') && path.endsWith('/templates')) {
    const segments = path.split('/');
    const clientId = Number(segments[2]);
    const user = requireJwt(req, res);
    if (!user) {
      return;
    }
    if (!(await requireClientRole(user, clientId, ['CLIENT_ADMIN', 'CLIENT_USER']))) {
      sendJson(res, 403, { error: 'Sem permissão.' });
      return;
    }
    const templates = await db
      .prepare(
        'SELECT id, name, language, category, status, meta_template_id, created_at FROM templates WHERE client_id = ? ORDER BY created_at DESC',
      )
      .all(clientId);
    sendJson(res, 200, { templates });
    return;
  }

  if (req.method === 'POST' && path.startsWith('api/clients/') && path.endsWith('/templates/media')) {
    const segments = path.split('/');
    const clientId = Number(segments[2]);
    const user = requireJwt(req, res);
    if (!user) {
      return;
    }
    if (!(await requireClientRole(user, clientId, ['CLIENT_ADMIN']))) {
      sendJson(res, 403, { error: 'Sem permissão.' });
      return;
    }
    readBody(req)
      .then(async (body) => {
        const payload = JSON.parse(body || '{}');
        const { fileBase64, mimeType, fileName } = payload;
        if (!fileBase64 || !mimeType) {
          sendJson(res, 400, { error: 'Arquivo inválido.' });
          return;
        }
        const whatsapp = await getWhatsappCredentials(clientId);
        if (!whatsapp?.token) {
          sendJson(res, 400, { error: 'Credenciais WhatsApp ausentes.' });
          return;
        }
        let mediaPhoneNumberId = whatsapp.phoneNumberId;
        if (!mediaPhoneNumberId && whatsapp.businessId) {
          try {
            mediaPhoneNumberId = await resolveWhatsAppPhoneNumberId({
              wabaId: whatsapp.businessId,
              accessToken: whatsapp.token,
            });
          } catch (err) {
            sendJson(res, 400, { error: 'Falha ao resolver phoneNumberId: ' + err.message });
            return;
          }
        }
        if (!mediaPhoneNumberId) {
          sendJson(res, 400, { error: 'phoneNumberId ausente e não foi possível resolver via WABA.' });
          return;
        }
        const buffer = Buffer.from(fileBase64, 'base64');
        const form = new FormData();
        form.append('messaging_product', 'whatsapp');
        form.append('type', mimeType);
        form.append('file', new Blob([buffer], { type: mimeType }), fileName || 'media');
        const response = await fetch(`https://graph.facebook.com/v19.0/${mediaPhoneNumberId}/media`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${whatsapp.token}`,
          },
          body: form,
        });
        const data = await response.json();
        if (!response.ok) {
          sendJson(res, 400, { error: data.error?.message || 'Falha ao enviar mídia.' });
          return;
        }
        await logAudit('template.media_upload', {
          clientId,
          userId: user.userId,
          metadata: { mediaId: data.id },
        });
        sendJson(res, 200, { mediaId: data.id });
      })
      .catch((error) => {
        console.error('[TEMPLATE] Falha no upload de mídia:', error);
        sendJson(res, 400, { error: 'Falha ao enviar mídia.' });
      });
    return;
  }

  if (req.method === 'POST' && path.startsWith('api/clients/') && path.endsWith('/templates')) {
    const segments = path.split('/');
    const clientId = Number(segments[2]);
    const user = requireJwt(req, res);
    if (!user) {
      return;
    }
    if (!(await requireClientRole(user, clientId, ['CLIENT_ADMIN', 'CLIENT_USER']))) {
      sendJson(res, 403, { error: 'Sem permissão.' });
      return;
    }
    readBody(req)
      .then(async (body) => {
        const payload = JSON.parse(body || '{}');
        const { name, language, category, bodyText, submit, businessId, mediaId } = payload;
        if (!name || !language || !category || !bodyText) {
          sendJson(res, 400, { error: 'Campos obrigatórios ausentes.' });
          return;
        }
        let status = 'DRAFT';
        let metaTemplateId = null;
        if (submit) {
          const whatsapp = await getWhatsappCredentials(clientId);
          if (!whatsapp?.token || !businessId) {
            sendJson(res, 400, { error: 'Credenciais WhatsApp ou businessId ausentes.' });
            return;
          }
          const components = [
            {
              type: 'BODY',
              text: bodyText,
            },
          ];
          if (mediaId) {
            components.unshift({
              type: 'HEADER',
              format: 'IMAGE',
              example: { header_handle: [mediaId] },
            });
          }
          const response = await fetch(
            `https://graph.facebook.com/v19.0/${businessId}/message_templates`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${whatsapp.token}`,
              },
              body: JSON.stringify({
                name,
                language,
                category,
                components,
              }),
            },
          );
          const data = await response.json();
          if (!response.ok) {
            sendJson(res, 400, { error: data.error?.message || 'Falha ao submeter template.' });
            return;
          }
          status = 'SUBMITTED';
          metaTemplateId = data.id;
        }
        const templateId = (await db
          .prepare(
            'INSERT INTO templates (client_id, name, language, category, body_text, status, meta_template_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
          )
          .run(clientId, name, language, category, bodyText, status, metaTemplateId, nowIso())).lastInsertRowid;
        await logAudit('template.create', {
          clientId,
          userId: user.userId,
          metadata: { templateId, status },
        });
        sendJson(res, 200, { templateId, status });
      })
      .catch((error) => {
        console.error('[TEMPLATE] Falha ao criar template:', error);
        sendJson(res, 400, { error: 'Falha ao criar template.' });
      });
    return;
  }

  if (req.method === 'POST' && path.startsWith('api/clients/') && path.endsWith('/contacts/upload')) {
    const segments = path.split('/');
    const clientId = Number(segments[2]);
    const user = requireJwt(req, res);
    if (!user) {
      return;
    }
    // Allow any authenticated user with client access to import contacts
    if (!(await requireClientAccess(user, clientId))) {
      console.log(`[CONTACTS_IMPORT_DENIED] reason=no_client_access user=${user.userId} client=${clientId}`);
      sendJson(res, 403, { error: 'Sem permissão.' });
      return;
    }
    readBody(req)
      .then(async (body) => {
        const payload = JSON.parse(body || '{}');
        let rows = [];
        
        // Parse based on format - CSV text or Excel base64
        if (payload.csv) {
          rows = parseCsv(payload.csv);
        } else if (payload.excel) {
          // Convert base64 to buffer
          const buffer = Buffer.from(payload.excel, 'base64');
          rows = await parseExcel(buffer);
        } else {
          throw new Error('No CSV or Excel data provided');
        }
        
        const insert = db.prepare(
          'INSERT INTO contacts (client_id, name, phone, email, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (client_id, phone) DO NOTHING',
        );
        let inserted = 0;
        let invalid = 0;
        for (const row of rows) {
          const phone = normalizePhone(row.phone || row.telefone || row.numero || row.number);
          if (!phone) {
            invalid += 1;
            continue;
          }
          const result = await insert.run(clientId, row.name || row.nome || '', phone, row.email || '', nowIso());
          if (result.changes > 0) {
            inserted += 1;
          }
        }
        console.log(`[CONTACTS_IMPORT_OK] user=${user.userId} client=${clientId} imported=${inserted} invalid=${invalid} total=${rows.length}`);
        await logAudit('contacts.upload', {
          clientId,
          userId: user.userId,
          metadata: { inserted, invalid, total: rows.length },
        });
        sendJson(res, 200, { inserted, invalid, total: rows.length });
      })
      .catch((error) => {
        console.error(`[CONTACTS_IMPORT_ERROR] reason=parse_error user=${user.userId} client=${clientId}`, error);
        sendJson(res, 400, { error: 'Falha ao importar contatos.' });
      });
    return;
  }

  if (req.method === 'POST' && path.startsWith('api/clients/') && path.endsWith('/campaigns')) {
    const segments = path.split('/');
    const clientId = Number(segments[2]);
    const user = requireJwt(req, res);
    if (!user) {
      return;
    }
    if (!(await requireClientRole(user, clientId, ['CLIENT_ADMIN', 'CLIENT_USER']))) {
      sendJson(res, 403, { error: 'Sem permissão.' });
      return;
    }
    readBody(req)
      .then(async (body) => {
        const payload = JSON.parse(body || '{}');
        if (!payload.name || !payload.templateId || !Array.isArray(payload.contactIds)) {
          sendJson(res, 400, { error: 'Campos obrigatórios ausentes.' });
          return;
        }
        const rateLimit = Number(payload.rateLimit || 20);
        const campaignId = (await db
          .prepare(
            'INSERT INTO campaigns (client_id, name, template_id, status, rate_limit, last_sent_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
          )
          .run(clientId, payload.name, payload.templateId, 'ACTIVE', rateLimit, null, nowIso()))
          .lastInsertRowid;
        const insert = db.prepare(
          'INSERT INTO campaign_contacts (campaign_id, contact_id, status, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (campaign_id, contact_id) DO NOTHING',
        );
        for (const contactId of payload.contactIds) {
          await insert.run(campaignId, contactId, 'PENDING', nowIso());
        }
        await logAudit('campaign.create', {
          clientId,
          userId: user.userId,
          metadata: { campaignId },
        });
        sendJson(res, 200, { campaignId });
      })
      .catch((error) => {
        console.error('[CAMPAIGN] Falha ao criar campanha:', error);
        sendJson(res, 400, { error: 'Falha ao criar campanha.' });
      });
    return;
  }

  if (req.method === 'GET' && path.startsWith('api/clients/') && path.endsWith('/campaigns')) {
    const segments = path.split('/');
    const clientId = Number(segments[2]);
    const user = requireJwt(req, res);
    if (!user) {
      return;
    }
    if (!(await requireClientRole(user, clientId, ['CLIENT_ADMIN', 'CLIENT_USER']))) {
      sendJson(res, 403, { error: 'Sem permissão.' });
      return;
    }
    const rows = await db
      .prepare(
        `SELECT c.id, c.name, c.status, c.rate_limit, c.created_at,
                (SELECT COUNT(*) FROM campaign_contacts cc WHERE cc.campaign_id = c.id) as total_contacts,
                (SELECT COUNT(*) FROM campaign_contacts cc WHERE cc.campaign_id = c.id AND cc.status = 'SENT') as sent_contacts
         FROM campaigns c
         WHERE c.client_id = ?
         ORDER BY c.created_at DESC`,
      )
      .all(clientId);
    sendJson(res, 200, { campaigns: rows });
    return;
  }

  if (req.method === 'POST' && path.startsWith('api/clients/') && path.includes('/campaigns/')) {
    const segments = path.split('/');
    const clientId = Number(segments[2]);
    const campaignId = Number(segments[4]);
    const action = segments[5];
    const user = requireJwt(req, res);
    if (!user) {
      return;
    }
    if (!(await requireClientRole(user, clientId, ['CLIENT_ADMIN', 'CLIENT_USER']))) {
      sendJson(res, 403, { error: 'Sem permissão.' });
      return;
    }
    if (!['pause', 'resume', 'cancel'].includes(action)) {
      sendJson(res, 404, { error: 'Ação inválida.' });
      return;
    }
    const status = action === 'pause' ? 'PAUSED' : action === 'resume' ? 'ACTIVE' : 'CANCELLED';
    await db.prepare('UPDATE campaigns SET status = ? WHERE id = ? AND client_id = ?').run(
      status,
      campaignId,
      clientId,
    );
    await logAudit('campaign.update', {
      clientId,
      userId: user.userId,
      metadata: { campaignId, status },
    });
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'GET' && path.startsWith('api/clients/') && path.endsWith('/conversations')) {
    const segments = path.split('/');
    const clientId = Number(segments[2]);
    const user = requireJwt(req, res);
    if (!user) {
      return;
    }
    if (!(await requireClientRole(user, clientId, ['CLIENT_ADMIN', 'CLIENT_USER']))) {
      sendJson(res, 403, { error: 'Sem permissão.' });
      return;
    }
    const search = (parsedUrl.query.search || '').trim();
    const rows = search
      ? await db
          .prepare(
            `SELECT c.id, c.phone, c.name,
                    (SELECT m.content FROM messages m WHERE m.contact_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
                    (SELECT m.created_at FROM messages m WHERE m.contact_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_at
             FROM contacts c
             WHERE c.client_id = ? AND (c.phone LIKE ? OR c.name LIKE ?)
             ORDER BY last_at IS NULL, last_at DESC`,
          )
          .all(clientId, `%${search}%`, `%${search}%`)
      : await db
          .prepare(
            `SELECT c.id, c.phone, c.name,
                    (SELECT m.content FROM messages m WHERE m.contact_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
                    (SELECT m.created_at FROM messages m WHERE m.contact_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_at
             FROM contacts c
             WHERE c.client_id = ?
             ORDER BY last_at IS NULL, last_at DESC`,
          )
          .all(clientId);
    sendJson(res, 200, { conversations: rows });
    return;
  }

  if (req.method === 'POST' && path.startsWith('api/clients/') && path.endsWith('/messages/send')) {
    const segments = path.split('/');
    const clientId = Number(segments[2]);
    const user = requireJwt(req, res);
    if (!user) {
      return;
    }
    if (!(await requireClientRole(user, clientId, ['CLIENT_ADMIN', 'CLIENT_USER']))) {
      sendJson(res, 403, { error: 'Sem permissão.' });
      return;
    }
    readBody(req)
      .then(async (body) => {
        const payload = JSON.parse(body || '{}');
        const phone = normalizePhone(payload.phone || '');
        const message = payload.message || '';
        if (!phone || !message) {
          sendJson(res, 400, { error: 'phone e message são obrigatórios.' });
          return;
        }
        if (await isOptedOut(clientId, phone)) {
          sendJson(res, 400, { error: 'Contato opt-out.' });
          return;
        }
        if (!(await canSendForTier(clientId))) {
          sendJson(res, 400, { error: 'Limite diário do tier Meta atingido.' });
          await logAudit('whatsapp.tier_blocked', {
            clientId,
            userId: user.userId,
            metadata: { phone },
          });
          return;
        }
        const contact = await ensureContact(clientId, phone);
        await logMessage(clientId, contact.id, 'OUTBOUND', message, 'HUMAN', 'QUEUED');
        const whatsapp = await getWhatsappCredentials(clientId);
        await sendWhatsAppMessage(phone, message, {
          token: whatsapp?.token,
          phoneNumberId: whatsapp?.phoneNumberId,
          businessId: whatsapp?.businessId,
        });
        await logAudit('message.manual_send', {
          clientId,
          userId: user.userId,
          metadata: { phone },
        });
        sendJson(res, 200, { ok: true });
      })
      .catch((error) => {
        console.error('[MESSAGE] Falha ao enviar:', error);
        sendJson(res, 400, { error: 'Falha ao enviar mensagem.' });
      });
    return;
  }

  if (req.method === 'GET' && path.startsWith('api/clients/') && path.endsWith('/messages')) {
    const segments = path.split('/');
    const clientId = Number(segments[2]);
    const user = requireJwt(req, res);
    if (!user) {
      return;
    }
    if (!(await requireClientRole(user, clientId, ['CLIENT_ADMIN', 'CLIENT_USER']))) {
      sendJson(res, 403, { error: 'Sem permissão.' });
      return;
    }
    const phone = parsedUrl.query.phone ? normalizePhone(parsedUrl.query.phone) : '';
    const rows = phone
      ? await db
          .prepare(
            `SELECT m.id, m.direction, m.content, m.source, m.status, m.created_at, c.phone
             FROM messages m
             LEFT JOIN contacts c ON c.id = m.contact_id
             WHERE m.client_id = ? AND c.phone = ?
             ORDER BY m.created_at DESC
             LIMIT 200`,
          )
          .all(clientId, phone)
      : await db
          .prepare(
            `SELECT m.id, m.direction, m.content, m.source, m.status, m.created_at, c.phone
             FROM messages m
             LEFT JOIN contacts c ON c.id = m.contact_id
             WHERE m.client_id = ?
             ORDER BY m.created_at DESC
             LIMIT 200`,
          )
          .all(clientId);
    sendJson(res, 200, { messages: rows });
    return;
  }

  if (req.method === 'GET' && path.startsWith('api/clients/') && path.endsWith('/contacts')) {
    const segments = path.split('/');
    const clientId = Number(segments[2]);
    const user = requireJwt(req, res);
    if (!user) {
      return;
    }
    if (!(await requireClientRole(user, clientId, ['CLIENT_ADMIN', 'CLIENT_USER']))) {
      sendJson(res, 403, { error: 'Sem permissão.' });
      return;
    }
    const search = parsedUrl.query.search ? String(parsedUrl.query.search) : '';
    const rows = search
      ? await db
          .prepare(
            'SELECT id, name, phone, email, created_at FROM contacts WHERE client_id = ? AND (name LIKE ? OR phone LIKE ?) ORDER BY created_at DESC LIMIT 200',
          )
          .all(clientId, `%${search}%`, `%${search}%`)
      : await db
          .prepare(
            'SELECT id, name, phone, email, created_at FROM contacts WHERE client_id = ? ORDER BY created_at DESC LIMIT 200',
          )
          .all(clientId);
    sendJson(res, 200, { contacts: rows });
    return;
  }

  if (req.method === 'POST' && path === 'api/clients') {
    const user = requireJwt(req, res, ['SUPER_ADMIN']);
    if (!user) {
      return;
    }
    readBody(req)
      .then(async (body) => {
        const payload = JSON.parse(body || '{}');
        if (!payload.name) {
          sendJson(res, 400, { error: 'Nome obrigatório.' });
          return;
        }
        const clientId = (await db
          .prepare('INSERT INTO clients (name, ai_enabled, created_at) VALUES (?, ?, ?) RETURNING id')
          .run(payload.name, payload.aiEnabled ? 1 : 0, nowIso())).lastInsertRowid;
        sendJson(res, 200, { clientId });
      })
      .catch((error) => {
        console.error('[CLIENT] Falha ao criar cliente:', error);
        sendJson(res, 400, { error: 'Falha ao criar cliente.' });
      });
    return;
  }

  if ((req.method === 'POST' || req.method === 'PATCH') && path.startsWith('api/clients/')) {
    const segments = path.split('/');
    if (segments.length === 3) {
      const clientId = Number(segments[2]);
      if (!clientId) {
        sendJson(res, 404, { error: 'Cliente inválido.' });
        return;
      }
      const user = requireJwt(req, res);
      if (!user) {
        return;
      }
      if (!(await requireClientRole(user, clientId, ['CLIENT_ADMIN']))) {
        sendJson(res, 403, { error: 'Sem permissão.' });
        return;
      }
      readBody(req)
        .then(async (body) => {
          const payload = JSON.parse(body || '{}');
          const updateFields = [];
          const params = [];
          const metadata = {};

          if (typeof payload.name === 'string' && payload.name.trim().length >= 2) {
            updateFields.push('name = ?');
            params.push(payload.name.trim());
            metadata.name = payload.name.trim();
          }

          if (typeof payload.aiEnabled === 'boolean') {
            updateFields.push('ai_enabled = ?');
            params.push(payload.aiEnabled ? 1 : 0);
            metadata.aiEnabled = payload.aiEnabled;
          } else if (payload.aiEnabled === 0 || payload.aiEnabled === 1) {
            updateFields.push('ai_enabled = ?');
            params.push(payload.aiEnabled);
            metadata.aiEnabled = Boolean(payload.aiEnabled);
          } else if (payload.aiEnabled === 'true' || payload.aiEnabled === 'false') {
            const enabled = payload.aiEnabled === 'true';
            updateFields.push('ai_enabled = ?');
            params.push(enabled ? 1 : 0);
            metadata.aiEnabled = enabled;
          }

          const aiDailyLimit = Number(payload.aiDailyLimit);
          if (Number.isFinite(aiDailyLimit) && aiDailyLimit > 0) {
            updateFields.push('ai_daily_limit = ?');
            params.push(aiDailyLimit);
            metadata.aiDailyLimit = aiDailyLimit;
          }

          const metaTierLimit = Number(payload.metaTierLimit);
          if (Number.isFinite(metaTierLimit) && metaTierLimit > 0) {
            updateFields.push('meta_tier_limit = ?');
            params.push(metaTierLimit);
            metadata.metaTierLimit = metaTierLimit;
          }

          if (updateFields.length === 0) {
            sendJson(res, 400, { error: 'Nenhum campo válido para atualizar.' });
            return;
          }

          const existing = await db.prepare('SELECT id FROM clients WHERE id = ?').get(clientId);
          if (!existing) {
            sendJson(res, 404, { error: 'Cliente não encontrado.' });
            return;
          }

          await db.prepare(`UPDATE clients SET ${updateFields.join(', ')} WHERE id = ?`).run(
            ...params,
            clientId,
          );

          const client = await db
            .prepare(
              'SELECT id, name, ai_enabled, ai_daily_limit, meta_tier_limit FROM clients WHERE id = ?',
            )
            .get(clientId);

          await logAudit('client.update', {
            clientId,
            userId: user.userId,
            metadata,
          });

          sendJson(res, 200, {
            ok: true,
            client: {
              id: client.id,
              name: client.name,
              aiEnabled: Boolean(client.ai_enabled),
              aiDailyLimit: client.ai_daily_limit,
              metaTierLimit: client.meta_tier_limit,
            },
          });
        })
        .catch((error) => {
          console.error('[CLIENT] Falha ao atualizar cliente:', error);
          sendJson(res, 400, { error: 'Falha ao atualizar cliente.' });
        });
      return;
    }
  }

  if (req.method === 'POST' && path.startsWith('api/clients/') && path.endsWith('/limits')) {
    const segments = path.split('/');
    const clientId = Number(segments[2]);
    const user = requireJwt(req, res);
    if (!user) {
      return;
    }
    if (!(await requireClientRole(user, clientId, ['CLIENT_ADMIN']))) {
      sendJson(res, 403, { error: 'Sem permissão.' });
      return;
    }
    readBody(req)
      .then(async (body) => {
        const payload = JSON.parse(body || '{}');
        const aiDailyLimit = Number(payload.aiDailyLimit || 0);
        const metaTierLimit = Number(payload.metaTierLimit || 0);
        if (!aiDailyLimit || !metaTierLimit) {
          sendJson(res, 400, { error: 'Informe aiDailyLimit e metaTierLimit.' });
          return;
        }
        await db.prepare('UPDATE clients SET ai_daily_limit = ?, meta_tier_limit = ? WHERE id = ?').run(
          aiDailyLimit,
          metaTierLimit,
          clientId,
        );
        await logAudit('client.limits_update', {
          clientId,
          userId: user.userId,
          metadata: { aiDailyLimit, metaTierLimit },
        });
        sendJson(res, 200, { ok: true });
      })
      .catch((error) => {
        console.error('[CLIENT] Falha ao atualizar limites:', error);
        sendJson(res, 400, { error: 'Falha ao atualizar limites.' });
      });
    return;
  }

  if (req.method === 'POST' && path.startsWith('api/clients/') && path.endsWith('/meta/tiers')) {
    const segments = path.split('/');
    const clientId = Number(segments[2]);
    const user = requireJwt(req, res);
    if (!user) {
      return;
    }
    if (!(await requireClientRole(user, clientId, ['CLIENT_ADMIN']))) {
      sendJson(res, 403, { error: 'Sem permissão.' });
      return;
    }
    readBody(req)
      .then(async (body) => {
        const payload = JSON.parse(body || '{}');
        if (!payload.businessId) {
          sendJson(res, 400, { error: 'Informe businessId.' });
          return;
        }
        const whatsapp = await getWhatsappCredentials(clientId);
        if (!whatsapp?.token) {
          sendJson(res, 400, { error: 'Credenciais WhatsApp ausentes.' });
          return;
        }
        const wabaResponse = await fetch(
          `https://graph.facebook.com/v19.0/${payload.businessId}/whatsapp_business_accounts`,
          {
            headers: { Authorization: `Bearer ${whatsapp.token}` },
          },
        );
        const wabaData = await wabaResponse.json();
        if (!wabaResponse.ok) {
          sendJson(res, 400, { error: wabaData.error?.message || 'Falha ao buscar WABA.' });
          return;
        }
        const wabaId = wabaData.data?.[0]?.id;
        if (!wabaId) {
          sendJson(res, 400, { error: 'WABA não encontrada.' });
          return;
        }
        const tierResponse = await fetch(
          `https://graph.facebook.com/v19.0/${wabaId}/tiers`,
          {
            headers: { Authorization: `Bearer ${whatsapp.token}` },
          },
        );
        const tierData = await tierResponse.json();
        if (!tierResponse.ok) {
          sendJson(res, 400, { error: tierData.error?.message || 'Falha ao buscar tier.' });
          return;
        }
        const tier = tierData.data?.[0]?.tier || 'TIER_1';
        const tierLimitMap = {
          TIER_1: 1000,
          TIER_2: 10000,
          TIER_3: 100000,
        };
        const metaTierLimit = tierLimitMap[tier] || 1000;
        await db.prepare('UPDATE clients SET meta_tier_limit = ? WHERE id = ?').run(metaTierLimit, clientId);
        await logAudit('meta.tier_refresh', {
          clientId,
          userId: user.userId,
          metadata: { tier, metaTierLimit },
        });
        sendJson(res, 200, { tier, metaTierLimit });
      })
      .catch((error) => {
        console.error('[META] Falha ao buscar tier:', error);
        sendJson(res, 400, { error: 'Falha ao buscar tier.' });
      });
    return;
  }

  if (req.method === 'GET' && path.startsWith('api/clients/')) {
    const [, , clientIdStr, resource] = path.split('/');
    const clientId = Number(clientIdStr);
    if (!clientId || !resource) {
      sendJson(res, 404, { error: 'Recurso inválido.' });
      return;
    }
    if (resource === 'summary') {
      const user = requireJwt(req, res);
      if (!user) {
        return;
      }
      if (!(await requireClientAccess(user, clientId))) {
        sendJson(res, 403, { error: 'Sem permissão.' });
        return;
      }
      const client = await db.prepare('SELECT id, name, ai_enabled FROM clients WHERE id = ?').get(clientId);
      sendJson(res, 200, { client });
      return;
    }
  }

  if (req.method === 'POST' && path.startsWith('api/clients/') && path.endsWith('/users')) {
    const segments = path.split('/');
    const clientId = Number(segments[2]);
    const user = requireJwt(req, res);
    if (!user) {
      return;
    }
    if (!(await requireClientRole(user, clientId, ['CLIENT_ADMIN']))) {
      sendJson(res, 403, { error: 'Sem permissão.' });
      return;
    }
    readBody(req)
      .then(async (body) => {
        const payload = JSON.parse(body || '{}');
        if (!payload.email || !payload.password) {
          sendJson(res, 400, { error: 'Email e senha obrigatórios.' });
          return;
        }
        const existing = await db.prepare('SELECT id, role FROM users WHERE email = ?').get(payload.email);
        const role = payload.role || 'CLIENT_USER';
        const userId = existing
          ? existing.id
          : (await db
              .prepare('INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, ?, ?) RETURNING id')
              .run(payload.email, hashPassword(payload.password), role, nowIso())).lastInsertRowid;
        await db.prepare(
          'INSERT INTO client_members (client_id, user_id, role, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (client_id, user_id) DO NOTHING',
        ).run(clientId, userId, role, nowIso());
        sendJson(res, 200, { userId });
      })
      .catch((error) => {
        console.error('[CLIENT] Falha ao criar usuário:', error);
        sendJson(res, 400, { error: 'Falha ao criar usuário.' });
      });
    return;
  }

  if (req.method === 'GET' && path === 'api/config/status') {
    if (!requireAuth(req, res)) {
      return;
    }
    sendJson(res, 200, { status: configStore.getStatus() });
    return;
  }

  if (req.method === 'GET' && path === 'api/config') {
    if (!requireAuth(req, res)) {
      return;
    }
    const config = configStore.getConfig();
    sendJson(res, 200, configStore.sanitizeConfigForClient(config));
    return;
  }

  if (req.method === 'POST' && path === 'api/config/save') {
    if (!requireAuth(req, res)) {
      return;
    }
    readBody(req)
      .then((body) => {
        const payload = JSON.parse(body || '{}');
        configStore.saveConfig(payload);
        sendJson(res, 200, { ok: true });
      })
      .catch((error) => {
        console.error('[CONFIG] Erro ao salvar:', error);
        sendJson(res, 400, { error: error.message || 'Erro ao salvar configuração.' });
      });
    return;
  }

  if (req.method === 'POST' && path === 'api/config/test-openai') {
    if (!requireAuth(req, res)) {
      return;
    }
    readBody(req)
      .then(async (body) => {
        const payload = JSON.parse(body || '{}');
        const config = configStore.getConfig();
        const apiKey = payload.apiKey || config?.openai?.apiKey;
        const assistantId = payload.assistantId || config?.openai?.assistantId;
        if (!apiKey || !assistantId) {
          sendJson(res, 400, { error: 'Informe apiKey e assistantId.' });
          return;
        }
        const response = await fetch(`https://api.openai.com/v1/assistants/${assistantId}`, {
          headers: { Authorization: `Bearer ${apiKey}`, 'OpenAI-Beta': 'assistants=v1' },
        });
        if (!response.ok) {
          const data = await response.json();
          sendJson(res, 400, { error: data.error?.message || 'Falha ao validar OpenAI.' });
          return;
        }
        sendJson(res, 200, { ok: true });
      })
      .catch((error) => {
        console.error('[CONFIG] Falha no teste OpenAI:', error);
        sendJson(res, 400, { error: 'Falha ao testar OpenAI.' });
      });
    return;
  }

  if (req.method === 'POST' && path === 'api/config/test-whatsapp') {
    if (!requireAuth(req, res)) {
      return;
    }
    readBody(req)
      .then(async (body) => {
        const payload = JSON.parse(body || '{}');
        const config = configStore.getConfig();
        const token = payload.token || config?.whatsapp?.token;
        let phoneNumberId = payload.phoneNumberId || config?.whatsapp?.phoneNumberId;
        if (!token) {
          sendJson(res, 400, { error: 'Informe o token.' });
          return;
        }
        if (!phoneNumberId && payload.businessId) {
          try {
            phoneNumberId = await resolveWhatsAppPhoneNumberId({
              wabaId: payload.businessId,
              accessToken: token,
            });
          } catch (err) {
            sendJson(res, 400, { error: err.message });
            return;
          }
        }
        if (!phoneNumberId) {
          sendJson(res, 400, { error: 'Informe phoneNumberId ou businessId para auto-resolução.' });
          return;
        }
        const response = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          const data = await response.json();
          sendJson(res, 400, { error: data.error?.message || 'Falha ao validar WhatsApp.' });
          return;
        }
        sendJson(res, 200, { ok: true, resolvedPhoneNumberId: phoneNumberId });
      })
      .catch((error) => {
        console.error('[CONFIG] Falha no teste WhatsApp:', error);
        sendJson(res, 400, { error: 'Falha ao testar WhatsApp.' });
      });
    return;
  }

  if (req.method === 'POST' && path.startsWith('api/clients/') && path.endsWith('/credentials/openai')) {
    const segments = path.split('/');
    const clientId = Number(segments[2]);
    const user = requireJwt(req, res);
    if (!user) {
      return;
    }
    if (!(await requireClientRole(user, clientId, ['CLIENT_ADMIN']))) {
      sendJson(res, 403, { error: 'Sem permissão.' });
      return;
    }
    readBody(req)
      .then(async (body) => {
        const payload = JSON.parse(body || '{}');
        if (!payload.apiKey || !payload.assistantId || !payload.commandPrompt) {
          sendJson(res, 400, { error: 'Informe apiKey, assistantId e commandPrompt.' });
          return;
        }
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${payload.apiKey}` },
        });
        if (!response.ok) {
          const data = await response.json();
          sendJson(res, 400, { error: data.error?.message || 'Falha ao validar OpenAI.' });
          return;
        }
        await db.prepare(
          `INSERT INTO openai_credentials (client_id, api_key_enc, assistant_id, command_prompt, created_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(client_id) DO UPDATE SET api_key_enc = excluded.api_key_enc, assistant_id = excluded.assistant_id, command_prompt = excluded.command_prompt`,
        ).run(clientId, encryptSecret(payload.apiKey), payload.assistantId, payload.commandPrompt, nowIso());
        await logAudit('credentials.openai_update', {
          clientId,
          userId: user.userId,
          metadata: { assistantId: payload.assistantId },
        });
        sendJson(res, 200, { ok: true });
      })
      .catch((error) => {
        console.error('[OPENAI] Falha ao salvar credenciais:', error);
        sendJson(res, 400, { error: 'Falha ao salvar OpenAI.' });
      });
    return;
  }

  if (req.method === 'POST' && path.startsWith('api/clients/') && path.endsWith('/credentials/whatsapp')) {
    const segments = path.split('/');
    const clientId = Number(segments[2]);
    const user = requireJwt(req, res);
    if (!user) {
      return;
    }
    if (!(await requireClientRole(user, clientId, ['CLIENT_ADMIN']))) {
      sendJson(res, 403, { error: 'Sem permissão.' });
      return;
    }
    readBody(req)
      .then(async (body) => {
        const payload = JSON.parse(body || '{}');
        if (!payload.token || !payload.businessId) {
          sendJson(res, 400, { error: 'Informe token e businessId.' });
          return;
        }
        const response = await fetch(
          `https://graph.facebook.com/v19.0/${payload.businessId}/phone_numbers`,
          { headers: { Authorization: `Bearer ${payload.token}` } },
        );
        const wabaData = await response.json();
        if (!response.ok) {
          sendJson(res, 400, { error: wabaData.error?.message || 'Falha ao validar WhatsApp.' });
          return;
        }
        let resolvedPhoneNumberId = payload.phoneNumberId || '';
        if (!resolvedPhoneNumberId) {
          if (wabaData.data && wabaData.data.length > 0) {
            resolvedPhoneNumberId = wabaData.data[0].id;
          }
        }
        if (!resolvedPhoneNumberId) {
          sendJson(res, 400, { error: 'Nenhum phoneNumberId encontrado. Informe manualmente ou verifique o businessId.' });
          return;
        }
        const cloudNumber = payload.cloudNumber || '';
        await db.prepare(
          `INSERT INTO whatsapp_credentials (client_id, token_enc, phone_number_id, cloud_number, business_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(client_id) DO UPDATE SET token_enc = excluded.token_enc, phone_number_id = excluded.phone_number_id, cloud_number = excluded.cloud_number, business_id = excluded.business_id`,
        ).run(clientId, encryptSecret(payload.token), resolvedPhoneNumberId, cloudNumber, payload.businessId, nowIso());
        await logAudit('credentials.whatsapp_update', {
          clientId,
          userId: user.userId,
          metadata: { phoneNumberId: resolvedPhoneNumberId },
        });
        sendJson(res, 200, { ok: true, resolvedPhoneNumberId });
      })
      .catch((error) => {
        console.error('[WHATSAPP] Falha ao salvar credenciais:', error);
        sendJson(res, 400, { error: 'Falha ao salvar WhatsApp.' });
      });
    return;
  }

  if (req.method === 'GET' && path.startsWith('api/clients/') && path.endsWith('/credentials/status')) {
    const segments = path.split('/');
    const clientId = Number(segments[2]);
    const user = requireJwt(req, res);
    if (!user) {
      return;
    }
    if (!(await requireClientRole(user, clientId, ['CLIENT_ADMIN', 'CLIENT_USER']))) {
      sendJson(res, 403, { error: 'Sem permissão.' });
      return;
    }
    const openai = await db.prepare('SELECT 1 FROM openai_credentials WHERE client_id = ?').get(clientId);
    const whatsapp = await db.prepare('SELECT 1 FROM whatsapp_credentials WHERE client_id = ?').get(clientId);
    const client = await db
      .prepare('SELECT ai_daily_limit, meta_tier_limit FROM clients WHERE id = ?')
      .get(clientId);
    sendJson(res, 200, {
      openaiSet: Boolean(openai),
      whatsappSet: Boolean(whatsapp),
      aiDailyLimit: client?.ai_daily_limit || 0,
      metaTierLimit: client?.meta_tier_limit || 0,
    });
    return;
  }

  // Endpoint de verificação do webhook (GET /webhook)
  if (req.method === 'GET' && path === 'webhook') {
    const mode = parsedUrl.query['hub.mode'];
    const token = parsedUrl.query['hub.verify_token'];
    const challenge = parsedUrl.query['hub.challenge'];
    if (!mode || !token || !challenge) {
      res.writeHead(400);
      res.end('Parâmetros ausentes (hub.*)');
      return;
    }
    const verifyToken = configStore.getWebhookToken();
    console.log('[WEBHOOK] Tentativa de verificação recebida');
    if (mode === 'subscribe' && token === verifyToken) {
      res.writeHead(200);
      res.end(challenge);
    } else {
      res.writeHead(403);
      res.end('Verify token inválido');
    }
    return;
  }

  // Receber mensagens do WhatsApp (POST /webhook)
  if (req.method === 'POST' && path === 'webhook') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', async () => {
      try {
        const json = JSON.parse(body);
        console.log('[WEBHOOK] Payload recebido:', JSON.stringify(json));
        let matchedClientId = null;
        if (Array.isArray(json.entry)) {
          for (const entry of json.entry) {
            if (Array.isArray(entry.changes)) {
              for (const change of entry.changes) {
                const value = change.value || {};
                const phoneNumberId = value.metadata?.phone_number_id;
                const client = phoneNumberId ? await getClientByPhoneNumberId(phoneNumberId) : null;
                if (client && client.id) {
                  matchedClientId = client.id;
                }
                await logWebhookEvent(matchedClientId, change.field || 'unknown', value);
                if (value.messages && value.messages[0] && value.messages[0].from) {
                  const phone = value.messages[0].from;
                  const msg = value.messages[0].text && value.messages[0].text.body;
                  if (msg && matchedClientId) {
                    await handleIncomingMessage(matchedClientId, phone, msg);
                  }
                }
                if (value.statuses && matchedClientId) {
                  for (const status of value.statuses) {
                    await db.prepare(
                      'INSERT INTO messages (client_id, contact_id, direction, content, source, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    ).run(
                      matchedClientId,
                      null,
                      'STATUS',
                      status.status || 'unknown',
                      'WEBHOOK',
                      status.status || 'unknown',
                      nowIso(),
                    );
                  }
                }
              }
            }
          }
        }
        res.writeHead(200);
        res.end('OK');
      } catch (e) {
        console.error('[WEBHOOK] Erro ao processar payload:', e);
        res.writeHead(400);
        res.end('Bad Request');
      }
    });
    return;
  }

  // Enviar mensagem manualmente (POST /send-message)
  if (req.method === 'POST' && path === 'send-message') {
    if (!requireAuth(req, res)) {
      return;
    }
    const contentType = req.headers['content-type'] || '';
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', async () => {
      try {
        let phone = '';
        let message = '';
        let clientId = null;
        let attachments = [];
        if (contentType.includes('multipart/form-data')) {
          const boundaryMatch = contentType.match(/boundary=(.+)$/);
          const boundary = boundaryMatch ? boundaryMatch[1] : '';
          const payload = parseMultipartFormData(body, boundary);
          phone = payload.fields.phone || '';
          message = payload.fields.message || '';
          clientId = payload.fields.clientId ? Number(payload.fields.clientId) : null;
          attachments = payload.files.map((file) => ({
            name: file.name,
            type: file.type,
          }));
        } else {
          const payload = JSON.parse(body);
          phone = payload.phone;
          message = payload.message;
          clientId = payload.clientId ? Number(payload.clientId) : null;
        }
        if (!phone || !message) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'phone e message são obrigatórios' }));
          return;
        }
        messages.push({ role: 'agent', content: message, phone, attachments });
        const whatsappConfig = clientId ? await getWhatsappCredentials(clientId) : configStore.getConfig()?.whatsapp;
        if (clientId) {
          const contact = await db
            .prepare('SELECT id FROM contacts WHERE client_id = ? AND phone = ?')
            .get(clientId, phone);
          const contactId = contact
            ? contact.id
            : (await db
                .prepare('INSERT INTO contacts (client_id, name, phone, email, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id')
                .run(clientId, null, phone, null, nowIso())).lastInsertRowid;
          await db.prepare(
            'INSERT INTO messages (client_id, contact_id, direction, content, source, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          ).run(clientId, contactId, 'OUTBOUND', message, 'AGENT', 'SENT', nowIso());
        }
        await sendWhatsAppMessage(phone, message, {
          token: whatsappConfig?.token,
          phoneNumberId: whatsappConfig?.phoneNumberId,
          businessId: whatsappConfig?.businessId,
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        console.error('[API] Erro ao enviar mensagem:', e);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Corpo inválido' }));
      }
    });
    return;
  }

  // Listar mensagens (GET /messages?phone=...)
  if (req.method === 'GET' && path === 'messages') {
    if (!requireAuth(req, res)) {
      return;
    }
    const phone = parsedUrl.query.phone;
    const filtered = phone ? messages.filter((m) => m.phone === phone) : messages;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(filtered));
    return;
  }

  // Rota não encontrada
  res.writeHead(404);
  res.end('Not Found');
});

async function processCampaigns() {
  try {
    const campaigns = await db
      .prepare('SELECT id, client_id, template_id, rate_limit, last_sent_at FROM campaigns WHERE status = ?')
      .all('ACTIVE');
    for (const campaign of campaigns) {
      const rateLimit = Math.max(Number(campaign.rate_limit || 1), 1);
      const intervalMs = Math.floor(60000 / rateLimit);
      const lastSentAt = campaign.last_sent_at ? Date.parse(campaign.last_sent_at) : 0;
      if (lastSentAt && Date.now() - lastSentAt < intervalMs) {
        continue;
      }
      const nextContact = await db
        .prepare(
          `SELECT cc.id as campaign_contact_id, c.id as contact_id, c.phone
           FROM campaign_contacts cc
           JOIN contacts c ON c.id = cc.contact_id
           WHERE cc.campaign_id = ? AND cc.status = ?
           ORDER BY cc.created_at ASC
           LIMIT 1`,
        )
        .get(campaign.id, 'PENDING');
      if (!nextContact) {
        await db.prepare('UPDATE campaigns SET status = ? WHERE id = ?').run('COMPLETED', campaign.id);
        continue;
      }
      const optOut = await db
        .prepare('SELECT 1 FROM opt_outs WHERE client_id = ? AND phone = ?')
        .get(campaign.client_id, nextContact.phone);
      if (optOut) {
        await db.prepare('UPDATE campaign_contacts SET status = ? WHERE id = ?').run('SKIPPED', nextContact.campaign_contact_id);
        continue;
      }
      const template = await db.prepare('SELECT body_text FROM templates WHERE id = ?').get(campaign.template_id);
      if (!template) {
        await db.prepare('UPDATE campaign_contacts SET status = ? WHERE id = ?').run('FAILED', nextContact.campaign_contact_id);
        continue;
      }
      const whatsapp = await getWhatsappCredentials(campaign.client_id);
      if (!whatsapp?.token) {
        await db.prepare('UPDATE campaign_contacts SET status = ? WHERE id = ?').run('FAILED', nextContact.campaign_contact_id);
        continue;
      }
      if (!(await canSendForTier(campaign.client_id))) {
        await logAudit('campaign.tier_blocked', {
          clientId: campaign.client_id,
          metadata: { campaignId: campaign.id },
        });
        continue;
      }
      await sendWhatsAppMessage(nextContact.phone, template.body_text, {
        token: whatsapp.token,
        phoneNumberId: whatsapp.phoneNumberId,
        businessId: whatsapp.businessId,
      });
      await db.prepare('UPDATE campaign_contacts SET status = ? WHERE id = ?').run('SENT', nextContact.campaign_contact_id);
      await db.prepare('UPDATE campaigns SET last_sent_at = ? WHERE id = ?').run(nowIso(), campaign.id);
      await db.prepare(
        'INSERT INTO messages (client_id, contact_id, direction, content, source, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(
        campaign.client_id,
        nextContact.contact_id,
        'OUTBOUND',
        template.body_text,
        'CAMPAIGN',
        'SENT',
        nowIso(),
      );
    }
  } catch (error) {
    console.error('[CAMPAIGN] Erro no processamento:', error);
  }
}

// In serverless environments, background intervals might not work as expected.
// For Vercel, consider using Cron Jobs.
if (process.env.NODE_ENV !== 'production') {
  setInterval(processCampaigns, 5000);
}

async function refreshTemplateStatuses() {
  try {
    const templates = await db
      .prepare(
        `SELECT id, client_id, meta_template_id, status
         FROM templates
         WHERE meta_template_id IS NOT NULL
           AND status IN ('SUBMITTED', 'PENDING', 'IN_REVIEW')`,
      )
      .all();
    for (const template of templates) {
      const whatsapp = await getWhatsappCredentials(template.client_id);
      if (!whatsapp?.token) {
        continue;
      }
      try {
        const response = await fetch(
          `https://graph.facebook.com/v19.0/${template.meta_template_id}?fields=status`,
          { headers: { Authorization: `Bearer ${whatsapp.token}` } },
        );
        const data = await response.json();
        if (!response.ok) {
          continue;
        }
        const nextStatus = data.status || template.status;
        if (nextStatus !== template.status) {
          await db.prepare('UPDATE templates SET status = ? WHERE id = ?').run(nextStatus, template.id);
          await logWebhookEvent(template.client_id, 'template_status', {
            templateId: template.id,
            metaTemplateId: template.meta_template_id,
            status: nextStatus,
          });
        }
      } catch (error) {
        console.error('[TEMPLATE] Falha ao atualizar status:', error);
      }
    }
  } catch (error) {
    console.error('[TEMPLATE] Erro no refresh:', error);
  }
}

if (process.env.NODE_ENV !== 'production') {
  setInterval(refreshTemplateStatuses, 15 * 60 * 1000);
}

// Definir porta e iniciar servidor
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`ClikPro WhatsApp App rodando na porta ${PORT}`);
});
