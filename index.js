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
const { parseCsv, normalizePhone } = require('./lib/csv');

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

function getClientMembership(userId, clientId) {
  return db
    .prepare('SELECT role FROM client_members WHERE user_id = ? AND client_id = ?')
    .get(userId, clientId);
}

function requireClientAccess(user, clientId) {
  if (!user) {
    return false;
  }
  if (user.role === 'SUPER_ADMIN') {
    return true;
  }
  const membership = getClientMembership(user.userId, clientId);
  return Boolean(membership);
}

function requireClientRole(user, clientId, roles) {
  if (!user) {
    return false;
  }
  if (user.role === 'SUPER_ADMIN') {
    return true;
  }
  const membership = getClientMembership(user.userId, clientId);
  if (!membership) {
    return false;
  }
  return roles.includes(membership.role);
}

function getClientByPhoneNumberId(phoneNumberId) {
  return db
    .prepare(
      `SELECT c.id, c.name, c.ai_enabled
       FROM whatsapp_credentials wc
       JOIN clients c ON c.id = wc.client_id
       WHERE wc.phone_number_id = ?`,
    )
    .get(phoneNumberId);
}

function getOpenAiCredentials(clientId) {
  const row = db
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

function getWhatsappCredentials(clientId) {
  const row = db
    .prepare('SELECT token_enc, phone_number_id, cloud_number FROM whatsapp_credentials WHERE client_id = ?')
    .get(clientId);
  if (!row) {
    return null;
  }
  return {
    token: decryptSecret(row.token_enc),
    phoneNumberId: row.phone_number_id,
    cloudNumber: row.cloud_number,
  };
}

function logWebhookEvent(clientId, eventType, payload) {
  db.prepare(
    'INSERT INTO webhook_events (client_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?)',
  ).run(clientId, eventType, JSON.stringify(payload || {}), nowIso());
}

function logAudit(action, { clientId = null, userId = null, metadata = {} } = {}) {
  db.prepare(
    'INSERT INTO audit_logs (client_id, user_id, action, metadata_json, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(clientId, userId, action, JSON.stringify(metadata), nowIso());
}

function ensureContact(clientId, phone) {
  const normalized = normalizePhone(phone);
  const existing = db
    .prepare('SELECT * FROM contacts WHERE client_id = ? AND phone = ?')
    .get(clientId, normalized);
  if (existing) {
    return existing;
  }
  const info = db
    .prepare('INSERT INTO contacts (client_id, name, phone, email, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(clientId, '', normalized, '', nowIso());
  return db.prepare('SELECT * FROM contacts WHERE id = ?').get(info.lastInsertRowid);
}

function logMessage(clientId, contactId, direction, content, source, status) {
  db.prepare(
    'INSERT INTO messages (client_id, contact_id, direction, content, source, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(clientId, contactId, direction, content, source, status, nowIso());
}

function isOptedOut(clientId, phone) {
  const normalized = normalizePhone(phone);
  const row = db.prepare('SELECT id FROM opt_outs WHERE client_id = ? AND phone = ?').get(clientId, normalized);
  return Boolean(row);
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function canUseAi(clientId) {
  const client = db
    .prepare('SELECT ai_daily_limit FROM clients WHERE id = ?')
    .get(clientId);
  if (!client || !client.ai_daily_limit) {
    return false;
  }
  const today = getTodayKey();
  const usage = db
    .prepare('SELECT request_count FROM ai_usage WHERE client_id = ? AND usage_date = ?')
    .get(clientId, today);
  return (usage?.request_count || 0) < client.ai_daily_limit;
}

function recordAiUsage(clientId) {
  const today = getTodayKey();
  db.prepare(
    `INSERT INTO ai_usage (client_id, usage_date, request_count, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(client_id, usage_date)
     DO UPDATE SET request_count = request_count + 1`,
  ).run(clientId, today, 1, nowIso());
}

function canSendForTier(clientId) {
  const client = db
    .prepare('SELECT meta_tier_limit FROM clients WHERE id = ?')
    .get(clientId);
  if (!client || !client.meta_tier_limit) {
    return false;
  }
  const today = getTodayKey();
  const sent = db
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
 * Envia uma mensagem para um telefone via API do WhatsApp Cloud.
 * Necessita das variáveis de ambiente WHATSAPP_TOKEN e
 * WHATSAPP_PHONE_NUMBER_ID.
 *
 * @param {string} phone Destinatário em formato E.164 (sem '+').
 * @param {string} message Texto a ser enviado.
 * @param {{ token?: string, phoneNumberId?: string }} options Credenciais.
 */
async function sendWhatsAppMessage(phone, message, options = {}) {
  const token = options.token || process.env.WHATSAPP_TOKEN;
  const phoneNumberId = options.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    console.error('[WA] API não configurada. Defina WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID.');
    return;
  }
  try {
    const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      to: phone,
      text: { body: message },
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('[WA] Erro ao enviar mensagem:', data);
    } else {
      console.log('[WA] Mensagem enviada:', data);
    }
  } catch (error) {
    console.error('[WA] Falha na requisição:', error);
  }
}

/**
 * Gera uma resposta simples baseada no texto do usuário. Este método
 * pode ser trocado por integrações com IA mais complexas.
 *
 * @param {string} userMessage Texto recebido do usuário.
 * @returns {string} Resposta do assistente.
 */
async function generateAIResponse(clientId, userMessage, openAiConfig) {
  const text = (userMessage || '').toLowerCase();
  if (text.includes('preço') || text.includes('preco') || text.includes('valor')) {
    return 'Os planos variam de acordo com suas necessidades. Podemos conversar mais para entender o melhor para você.';
  }
  if (text.includes('olá') || text.includes('oi') || text.includes('bom dia') || text.includes('boa tarde') || text.includes('boa noite')) {
    return 'Olá! Como posso te ajudar hoje?';
  }
  if (openAiConfig && openAiConfig.apiKey && canUseAi(clientId)) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openAiConfig.apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `${openAiConfig.commandPrompt} (Assistant ID: ${openAiConfig.assistantId})`,
            },
            { role: 'user', content: userMessage },
          ],
        }),
      });
      clearTimeout(timeout);
      const data = await response.json();
      if (response.ok && data.choices && data.choices[0]?.message?.content) {
        recordAiUsage(clientId);
        return data.choices[0].message.content.trim();
      }
      console.error('[OpenAI] Resposta inválida:', data);
    } catch (error) {
      console.error('[OpenAI] Falha ao gerar resposta:', error);
      logAudit('openai.error', { clientId, metadata: { message: String(error) } });
    }
  }
  if (openAiConfig && openAiConfig.apiKey && !canUseAi(clientId)) {
    logAudit('openai.limit_reached', { clientId });
  }
  return 'Obrigado pela mensagem! Em breve um de nossos consultores entrará em contato.';
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
  const contact = ensureContact(clientId, normalizedPhone);
  logMessage(clientId, contact.id, 'INBOUND', text, 'WEBHOOK', 'RECEIVED');
  if (isOptedOut(clientId, normalizedPhone)) {
    return;
  }

  const client = db.prepare('SELECT ai_enabled FROM clients WHERE id = ?').get(clientId);
  let aiResponse = '';
  if (client && client.ai_enabled) {
    const openAiConfig = getOpenAiCredentials(clientId);
    aiResponse = await generateAIResponse(clientId, text, openAiConfig);
  }
  if (!aiResponse) {
    aiResponse = 'Obrigado pela mensagem! Em breve um de nossos consultores entrará em contato.';
  }
  messages.push({ role: 'ai', content: aiResponse, phone: normalizedPhone });
  logMessage(clientId, contact.id, 'OUTBOUND', aiResponse, 'AI', 'QUEUED');
  const whatsappConfig = getWhatsappCredentials(clientId);
  if (!canSendForTier(clientId)) {
    logAudit('whatsapp.tier_blocked', {
      clientId,
      metadata: { phone: normalizedPhone },
    });
    return;
  }
  sendWhatsAppMessage(normalizedPhone, aiResponse, {
    token: whatsappConfig?.token,
    phoneNumberId: whatsappConfig?.phoneNumberId,
  });
}

/**
 * Servidor HTTP principal. Trata requisições de webhook e interface web.
 */
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname.replace(/^\/+|\/+$/g, '');

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
      .then((body) => {
        const payload = JSON.parse(body || '{}');
        const existing = db.prepare('SELECT COUNT(*) as total FROM users').get();
        if (existing.total > 0) {
          sendJson(res, 400, { error: 'Seed já realizado.' });
          return;
        }
        if (!payload.email || !payload.password || !payload.clientName) {
          sendJson(res, 400, { error: 'Informe email, password e clientName.' });
          return;
        }
        const userId = db
          .prepare('INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, ?, ?)')
          .run(payload.email, hashPassword(payload.password), 'SUPER_ADMIN', nowIso()).lastInsertRowid;
        const clientId = db
          .prepare('INSERT INTO clients (name, ai_enabled, created_at) VALUES (?, ?, ?)')
          .run(payload.clientName, 1, nowIso()).lastInsertRowid;
        db.prepare(
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
      .then((body) => {
        const payload = JSON.parse(body || '{}');
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(payload.email);
        if (!user || !verifyPassword(payload.password || '', user.password_hash)) {
          sendJson(res, 401, { error: 'Credenciais inválidas.' });
          return;
        }
        const token = jwt.sign({ userId: user.id, role: user.role, email: user.email });
        logAudit('auth.login', { userId: user.id });
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
    const clients = db.prepare('SELECT id, name, ai_enabled, created_at FROM clients').all();
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
    if (!requireClientRole(user, clientId, ['CLIENT_ADMIN', 'CLIENT_USER'])) {
      sendJson(res, 403, { error: 'Sem permissão.' });
      return;
    }
    const templates = db
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
    if (!requireClientRole(user, clientId, ['CLIENT_ADMIN'])) {
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
        const whatsapp = getWhatsappCredentials(clientId);
        if (!whatsapp?.token || !whatsapp.phoneNumberId) {
          sendJson(res, 400, { error: 'Credenciais WhatsApp ausentes.' });
          return;
        }
        const buffer = Buffer.from(fileBase64, 'base64');
        const form = new FormData();
        form.append('messaging_product', 'whatsapp');
        form.append('type', mimeType);
        form.append('file', new Blob([buffer], { type: mimeType }), fileName || 'media');
        const response = await fetch(`https://graph.facebook.com/v19.0/${whatsapp.phoneNumberId}/media`, {
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
        logAudit('template.media_upload', {
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
    if (!requireClientRole(user, clientId, ['CLIENT_ADMIN', 'CLIENT_USER'])) {
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
          const whatsapp = getWhatsappCredentials(clientId);
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
                category,
                language,
                components,
              }),
            },
          );
          const data = await response.json();
          if (!response.ok) {
            sendJson(res, 400, { error: data.error?.message || 'Falha ao enviar template.' });
            return;
          }
          status = data.status || 'SUBMITTED';
          metaTemplateId = data.id || null;
        }
        const templateId = db
          .prepare(
            'INSERT INTO templates (client_id, name, language, category, body_text, status, meta_template_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          )
          .run(clientId, name, language, category, bodyText, status, metaTemplateId, nowIso()).lastInsertRowid;
        logAudit('template.create', {
          clientId,
          userId: user.userId,
          metadata: { templateId, status },
        });
        sendJson(res, 200, { templateId, status, metaTemplateId });
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
    if (!requireClientAccess(user, clientId)) {
      console.log(`[CONTACTS_IMPORT_DENIED] reason=no_client_access user=${user.userId} client=${clientId}`);
      sendJson(res, 403, { error: 'Sem permissão.' });
      return;
    }
    readBody(req)
      .then((body) => {
        const payload = JSON.parse(body || '{}');
        const rows = parseCsv(payload.csv || '');
        const insert = db.prepare(
          'INSERT OR IGNORE INTO contacts (client_id, name, phone, email, created_at) VALUES (?, ?, ?, ?, ?)',
        );
        let inserted = 0;
        let invalid = 0;
        rows.forEach((row) => {
          const phone = normalizePhone(row.phone || row.telefone || row.numero || row.number);
          if (!phone) {
            invalid += 1;
            return;
          }
          const result = insert.run(clientId, row.name || row.nome || '', phone, row.email || '', nowIso());
          if (result.changes > 0) {
            inserted += 1;
          }
        });
        console.log(`[CONTACTS_IMPORT_OK] user=${user.userId} client=${clientId} imported=${inserted} invalid=${invalid} total=${rows.length}`);
        logAudit('contacts.upload', {
          clientId,
          userId: user.userId,
          metadata: { inserted, invalid, total: rows.length },
        });
        sendJson(res, 200, { inserted, invalid, total: rows.length });
      })
      .catch((error) => {
        console.error(`[CONTACTS_IMPORT_ERROR] reason=parse_error user=${user.userId} client=${clientId}`);
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
    if (!requireClientRole(user, clientId, ['CLIENT_ADMIN', 'CLIENT_USER'])) {
      sendJson(res, 403, { error: 'Sem permissão.' });
      return;
    }
    readBody(req)
      .then((body) => {
        const payload = JSON.parse(body || '{}');
        if (!payload.name || !payload.templateId || !Array.isArray(payload.contactIds)) {
          sendJson(res, 400, { error: 'Campos obrigatórios ausentes.' });
          return;
        }
        const rateLimit = Number(payload.rateLimit || 20);
        const campaignId = db
          .prepare(
            'INSERT INTO campaigns (client_id, name, template_id, status, rate_limit, last_sent_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          )
          .run(clientId, payload.name, payload.templateId, 'ACTIVE', rateLimit, null, nowIso())
          .lastInsertRowid;
        const insert = db.prepare(
          'INSERT OR IGNORE INTO campaign_contacts (campaign_id, contact_id, status, created_at) VALUES (?, ?, ?, ?)',
        );
        payload.contactIds.forEach((contactId) => {
          insert.run(campaignId, contactId, 'PENDING', nowIso());
        });
        logAudit('campaign.create', {
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
    if (!requireClientRole(user, clientId, ['CLIENT_ADMIN', 'CLIENT_USER'])) {
      sendJson(res, 403, { error: 'Sem permissão.' });
      return;
    }
    const rows = db
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
    if (!requireClientRole(user, clientId, ['CLIENT_ADMIN', 'CLIENT_USER'])) {
      sendJson(res, 403, { error: 'Sem permissão.' });
      return;
    }
    if (!['pause', 'resume', 'cancel'].includes(action)) {
      sendJson(res, 404, { error: 'Ação inválida.' });
      return;
    }
    const status = action === 'pause' ? 'PAUSED' : action === 'resume' ? 'ACTIVE' : 'CANCELLED';
    db.prepare('UPDATE campaigns SET status = ? WHERE id = ? AND client_id = ?').run(
      status,
      campaignId,
      clientId,
    );
    logAudit('campaign.update', {
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
    if (!requireClientRole(user, clientId, ['CLIENT_ADMIN', 'CLIENT_USER'])) {
      sendJson(res, 403, { error: 'Sem permissão.' });
      return;
    }
    const search = (parsedUrl.query.search || '').trim();
    const rows = search
      ? db
          .prepare(
            `SELECT c.id, c.phone, c.name,
                    (SELECT m.content FROM messages m WHERE m.contact_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
                    (SELECT m.created_at FROM messages m WHERE m.contact_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_at
             FROM contacts c
             WHERE c.client_id = ? AND (c.phone LIKE ? OR c.name LIKE ?)
             ORDER BY last_at IS NULL, last_at DESC`,
          )
          .all(clientId, `%${search}%`, `%${search}%`)
      : db
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
    if (!requireClientRole(user, clientId, ['CLIENT_ADMIN', 'CLIENT_USER'])) {
      sendJson(res, 403, { error: 'Sem permissão.' });
      return;
    }
    readBody(req)
      .then((body) => {
        const payload = JSON.parse(body || '{}');
        const phone = normalizePhone(payload.phone || '');
        const message = payload.message || '';
        if (!phone || !message) {
          sendJson(res, 400, { error: 'phone e message são obrigatórios.' });
          return;
        }
        if (isOptedOut(clientId, phone)) {
          sendJson(res, 400, { error: 'Contato opt-out.' });
          return;
        }
        if (!canSendForTier(clientId)) {
          sendJson(res, 400, { error: 'Limite diário do tier Meta atingido.' });
          logAudit('whatsapp.tier_blocked', {
            clientId,
            userId: user.userId,
            metadata: { phone },
          });
          return;
        }
        const contact = ensureContact(clientId, phone);
        logMessage(clientId, contact.id, 'OUTBOUND', message, 'HUMAN', 'QUEUED');
        const whatsapp = getWhatsappCredentials(clientId);
        sendWhatsAppMessage(phone, message, {
          token: whatsapp?.token,
          phoneNumberId: whatsapp?.phoneNumberId,
        });
        logAudit('message.manual_send', {
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
    if (!requireClientRole(user, clientId, ['CLIENT_ADMIN', 'CLIENT_USER'])) {
      sendJson(res, 403, { error: 'Sem permissão.' });
      return;
    }
    const phone = parsedUrl.query.phone ? normalizePhone(parsedUrl.query.phone) : '';
    const rows = phone
      ? db
          .prepare(
            `SELECT m.id, m.direction, m.content, m.source, m.status, m.created_at, c.phone
             FROM messages m
             LEFT JOIN contacts c ON c.id = m.contact_id
             WHERE m.client_id = ? AND c.phone = ?
             ORDER BY m.created_at DESC
             LIMIT 200`,
          )
          .all(clientId, phone)
      : db
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
    if (!requireClientRole(user, clientId, ['CLIENT_ADMIN', 'CLIENT_USER'])) {
      sendJson(res, 403, { error: 'Sem permissão.' });
      return;
    }
    const search = parsedUrl.query.search ? String(parsedUrl.query.search) : '';
    const rows = search
      ? db
          .prepare(
            'SELECT id, name, phone, email, created_at FROM contacts WHERE client_id = ? AND (name LIKE ? OR phone LIKE ?) ORDER BY created_at DESC LIMIT 200',
          )
          .all(clientId, `%${search}%`, `%${search}%`)
      : db
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
      .then((body) => {
        const payload = JSON.parse(body || '{}');
        if (!payload.name) {
          sendJson(res, 400, { error: 'Nome obrigatório.' });
          return;
        }
        const clientId = db
          .prepare('INSERT INTO clients (name, ai_enabled, created_at) VALUES (?, ?, ?)')
          .run(payload.name, payload.aiEnabled ? 1 : 0, nowIso()).lastInsertRowid;
        sendJson(res, 200, { clientId });
      })
      .catch((error) => {
        console.error('[CLIENT] Falha ao criar cliente:', error);
        sendJson(res, 400, { error: 'Falha ao criar cliente.' });
      });
    return;
  }

  if (req.method === 'POST' && path.startsWith('api/clients/') && path.endsWith('/limits')) {
    const segments = path.split('/');
    const clientId = Number(segments[2]);
    const user = requireJwt(req, res);
    if (!user) {
      return;
    }
    if (!requireClientRole(user, clientId, ['CLIENT_ADMIN'])) {
      sendJson(res, 403, { error: 'Sem permissão.' });
      return;
    }
    readBody(req)
      .then((body) => {
        const payload = JSON.parse(body || '{}');
        const aiDailyLimit = Number(payload.aiDailyLimit || 0);
        const metaTierLimit = Number(payload.metaTierLimit || 0);
        if (!aiDailyLimit || !metaTierLimit) {
          sendJson(res, 400, { error: 'Informe aiDailyLimit e metaTierLimit.' });
          return;
        }
        db.prepare('UPDATE clients SET ai_daily_limit = ?, meta_tier_limit = ? WHERE id = ?').run(
          aiDailyLimit,
          metaTierLimit,
          clientId,
        );
        logAudit('client.limits_update', {
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
    if (!requireClientRole(user, clientId, ['CLIENT_ADMIN'])) {
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
        const whatsapp = getWhatsappCredentials(clientId);
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
        db.prepare('UPDATE clients SET meta_tier_limit = ? WHERE id = ?').run(metaTierLimit, clientId);
        logAudit('meta.tier_refresh', {
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
      if (!requireClientAccess(user, clientId)) {
        sendJson(res, 403, { error: 'Sem permissão.' });
        return;
      }
      const client = db.prepare('SELECT id, name, ai_enabled FROM clients WHERE id = ?').get(clientId);
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
    if (!requireClientRole(user, clientId, ['CLIENT_ADMIN'])) {
      sendJson(res, 403, { error: 'Sem permissão.' });
      return;
    }
    readBody(req)
      .then((body) => {
        const payload = JSON.parse(body || '{}');
        if (!payload.email || !payload.password) {
          sendJson(res, 400, { error: 'Email e senha obrigatórios.' });
          return;
        }
        const existing = db.prepare('SELECT id, role FROM users WHERE email = ?').get(payload.email);
        const role = payload.role || 'CLIENT_USER';
        const userId = existing
          ? existing.id
          : db
              .prepare('INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, ?, ?)')
              .run(payload.email, hashPassword(payload.password), role, nowIso()).lastInsertRowid;
        db.prepare(
          'INSERT OR IGNORE INTO client_members (client_id, user_id, role, created_at) VALUES (?, ?, ?, ?)',
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
          headers: { Authorization: `Bearer ${apiKey}` },
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
        const phoneNumberId = payload.phoneNumberId || config?.whatsapp?.phoneNumberId;
        if (!token || !phoneNumberId) {
          sendJson(res, 400, { error: 'Informe token e phoneNumberId.' });
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
        sendJson(res, 200, { ok: true });
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
    if (!requireClientRole(user, clientId, ['CLIENT_ADMIN'])) {
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
        db.prepare(
          `INSERT INTO openai_credentials (client_id, api_key_enc, assistant_id, command_prompt, created_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(client_id) DO UPDATE SET api_key_enc = excluded.api_key_enc, assistant_id = excluded.assistant_id, command_prompt = excluded.command_prompt`,
        ).run(clientId, encryptSecret(payload.apiKey), payload.assistantId, payload.commandPrompt, nowIso());
        logAudit('credentials.openai_update', {
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
    if (!requireClientRole(user, clientId, ['CLIENT_ADMIN'])) {
      sendJson(res, 403, { error: 'Sem permissão.' });
      return;
    }
    readBody(req)
      .then(async (body) => {
        const payload = JSON.parse(body || '{}');
        if (!payload.token || !payload.phoneNumberId || !payload.cloudNumber || !payload.businessId) {
          sendJson(res, 400, { error: 'Informe token, phoneNumberId, cloudNumber e businessId.' });
          return;
        }
        const response = await fetch(
          `https://graph.facebook.com/v19.0/${payload.businessId}/phone_numbers`,
          { headers: { Authorization: `Bearer ${payload.token}` } },
        );
        if (!response.ok) {
          const data = await response.json();
          sendJson(res, 400, { error: data.error?.message || 'Falha ao validar WhatsApp.' });
          return;
        }
        db.prepare(
          `INSERT INTO whatsapp_credentials (client_id, token_enc, phone_number_id, cloud_number, created_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(client_id) DO UPDATE SET token_enc = excluded.token_enc, phone_number_id = excluded.phone_number_id, cloud_number = excluded.cloud_number`,
        ).run(clientId, encryptSecret(payload.token), payload.phoneNumberId, payload.cloudNumber, nowIso());
        logAudit('credentials.whatsapp_update', {
          clientId,
          userId: user.userId,
          metadata: { phoneNumberId: payload.phoneNumberId },
        });
        sendJson(res, 200, { ok: true });
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
    if (!requireClientRole(user, clientId, ['CLIENT_ADMIN', 'CLIENT_USER'])) {
      sendJson(res, 403, { error: 'Sem permissão.' });
      return;
    }
    const openai = db.prepare('SELECT 1 FROM openai_credentials WHERE client_id = ?').get(clientId);
    const whatsapp = db.prepare('SELECT 1 FROM whatsapp_credentials WHERE client_id = ?').get(clientId);
    const client = db
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
    req.on('end', () => {
      try {
        const json = JSON.parse(body);
        console.log('[WEBHOOK] Payload recebido:', JSON.stringify(json));
        let matchedClientId = null;
        if (Array.isArray(json.entry)) {
          json.entry.forEach((entry) => {
            if (Array.isArray(entry.changes)) {
              entry.changes.forEach((change) => {
                const value = change.value || {};
                const phoneNumberId = value.metadata?.phone_number_id;
                const client = phoneNumberId ? getClientByPhoneNumberId(phoneNumberId) : null;
                if (client && client.id) {
                  matchedClientId = client.id;
                }
                logWebhookEvent(matchedClientId, change.field || 'unknown', value);
                if (value.messages && value.messages[0] && value.messages[0].from) {
                  const phone = value.messages[0].from;
                  const msg = value.messages[0].text && value.messages[0].text.body;
                  if (msg && matchedClientId) {
                    handleIncomingMessage(matchedClientId, phone, msg);
                  }
                }
                if (value.statuses && matchedClientId) {
                  value.statuses.forEach((status) => {
                    db.prepare(
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
                  });
                }
              });
            }
          });
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
    req.on('end', () => {
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
        const whatsappConfig = clientId ? getWhatsappCredentials(clientId) : configStore.getConfig()?.whatsapp;
        if (clientId) {
          const contact = db
            .prepare('SELECT id FROM contacts WHERE client_id = ? AND phone = ?')
            .get(clientId, phone);
          const contactId = contact
            ? contact.id
            : db
                .prepare('INSERT INTO contacts (client_id, name, phone, email, created_at) VALUES (?, ?, ?, ?, ?)')
                .run(clientId, null, phone, null, nowIso()).lastInsertRowid;
          db.prepare(
            'INSERT INTO messages (client_id, contact_id, direction, content, source, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          ).run(clientId, contactId, 'OUTBOUND', message, 'AGENT', 'SENT', nowIso());
        }
        sendWhatsAppMessage(phone, message, {
          token: whatsappConfig?.token,
          phoneNumberId: whatsappConfig?.phoneNumberId,
        }).then(() => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        });
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

function processCampaigns() {
  const campaigns = db
    .prepare('SELECT id, client_id, template_id, rate_limit, last_sent_at FROM campaigns WHERE status = ?')
    .all('ACTIVE');
  campaigns.forEach((campaign) => {
    const rateLimit = Math.max(Number(campaign.rate_limit || 1), 1);
    const intervalMs = Math.floor(60000 / rateLimit);
    const lastSentAt = campaign.last_sent_at ? Date.parse(campaign.last_sent_at) : 0;
    if (lastSentAt && Date.now() - lastSentAt < intervalMs) {
      return;
    }
    const nextContact = db
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
      db.prepare('UPDATE campaigns SET status = ? WHERE id = ?').run('COMPLETED', campaign.id);
      return;
    }
    const optOut = db
      .prepare('SELECT 1 FROM opt_outs WHERE client_id = ? AND phone = ?')
      .get(campaign.client_id, nextContact.phone);
    if (optOut) {
      db.prepare('UPDATE campaign_contacts SET status = ? WHERE id = ?').run('SKIPPED', nextContact.campaign_contact_id);
      return;
    }
    const template = db.prepare('SELECT body_text FROM templates WHERE id = ?').get(campaign.template_id);
    if (!template) {
      db.prepare('UPDATE campaign_contacts SET status = ? WHERE id = ?').run('FAILED', nextContact.campaign_contact_id);
      return;
    }
    const whatsapp = getWhatsappCredentials(campaign.client_id);
    if (!whatsapp?.token) {
      db.prepare('UPDATE campaign_contacts SET status = ? WHERE id = ?').run('FAILED', nextContact.campaign_contact_id);
      return;
    }
    if (!canSendForTier(campaign.client_id)) {
      logAudit('campaign.tier_blocked', {
        clientId: campaign.client_id,
        metadata: { campaignId: campaign.id },
      });
      return;
    }
    sendWhatsAppMessage(nextContact.phone, template.body_text, {
      token: whatsapp.token,
      phoneNumberId: whatsapp.phoneNumberId,
    });
    db.prepare('UPDATE campaign_contacts SET status = ? WHERE id = ?').run('SENT', nextContact.campaign_contact_id);
    db.prepare('UPDATE campaigns SET last_sent_at = ? WHERE id = ?').run(nowIso(), campaign.id);
    db.prepare(
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
  });
}

setInterval(processCampaigns, 5000);

async function refreshTemplateStatuses() {
  const templates = db
    .prepare(
      `SELECT id, client_id, meta_template_id, status
       FROM templates
       WHERE meta_template_id IS NOT NULL
         AND status IN ('SUBMITTED', 'PENDING', 'IN_REVIEW')`,
    )
    .all();
  for (const template of templates) {
    const whatsapp = getWhatsappCredentials(template.client_id);
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
        db.prepare('UPDATE templates SET status = ? WHERE id = ?').run(nextStatus, template.id);
        logWebhookEvent(template.client_id, 'template_status', {
          templateId: template.id,
          metaTemplateId: template.meta_template_id,
          status: nextStatus,
        });
      }
    } catch (error) {
      console.error('[TEMPLATE] Falha ao atualizar status:', error);
    }
  }
}

setInterval(refreshTemplateStatuses, 15 * 60 * 1000);

// Definir porta e iniciar servidor
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`ClikPro WhatsApp App rodando na porta ${PORT}`);
});
