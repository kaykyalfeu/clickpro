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
          to: phone,
          type: 'text',
          text: { body: text },
        }),
      },
    );
    const data = await response.json();
    if (!response.ok) {
      console.error('[WhatsApp] Erro ao enviar mensagem:', data);
    }
  } catch (error) {
    console.error('[WhatsApp] Falha na requisição de envio:', error);
  }
}

async function generateAIResponse(clientId, text, config) {
  if (!config?.apiKey || !config?.assistantId) {
    return null;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: config.commandPrompt || 'Você é um assistente prestativo.' },
          { role: 'user', content: text },
        ],
      }),
    });
    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error('[AI] Erro ao gerar resposta:', error);
    return null;
  }
}

async function handleIncomingMessage(clientId, phone, text) {
  const normalizedPhone = normalizePhone(phone);
  if (await isOptedOut(clientId, normalizedPhone)) {
    return;
  }

  const contact = await ensureContact(clientId, normalizedPhone);
  await logMessage(clientId, contact.id, 'INBOUND', text, 'WHATSAPP', 'RECEIVED');

  messages.push({ role: 'user', content: text, phone: normalizedPhone });

  let aiResponse = null;
  const client = await db.prepare('SELECT ai_enabled FROM clients WHERE id = ?').get(clientId);

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
  await sendWhatsAppMessage(normalizedPhone, aiResponse, whatsappConfig);
}

const requestHandler = async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname.replace(/^\/+|\/+$/g, '');

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (req.method === 'GET' && path === 'webhook') {
      const challenge = parsedUrl.query['hub.challenge'];
      const verifyToken = parsedUrl.query['hub.verify_token'];
      const expectedToken = configStore.get('VERIFY_TOKEN');

      if (verifyToken === expectedToken) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(challenge);
      } else {
        res.writeHead(403);
        res.end('Forbidden');
      }
    } else if (req.method === 'POST' && path === 'webhook') {
      const body = await readBody(req);
      const data = JSON.parse(body);

      const phoneNumberId = data.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
      const message = data.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

      if (phoneNumberId && message?.type === 'text') {
        const client = await getClientByPhoneNumberId(phoneNumberId);
        if (client) {
          await logWebhookEvent(client.id, 'MESSAGE_RECEIVED', data);
          await handleIncomingMessage(client.id, message.from, message.text.body);
        }
      }
      sendJson(res, 200, { status: 'ok' });
    } else if (path.startsWith('api/')) {
      const apiPath = path.substring(4);
      const user = requireJwt(req, res, ['SUPER_ADMIN', 'ADMIN', 'CLIENT_USER']);
      if (!user) return;

      if (apiPath === 'clients' && req.method === 'GET') {
        const clients = await db.prepare('SELECT id, name FROM clients').all();
        sendJson(res, 200, clients);
      } else if (apiPath.match(/^clients\/([^\/]+)$/) && req.method === 'GET') {
        const clientId = apiPath.split('/')[1];
        const client = await db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
        sendJson(res, 200, client);
      } else if (apiPath.match(/^clients\/([^\/]+)\/credentials\/status$/) && req.method === 'GET') {
        const clientId = apiPath.split('/')[1];
        const openai = await db.prepare('SELECT id FROM openai_credentials WHERE client_id = ?').get(clientId);
        const whatsapp = await db.prepare('SELECT id FROM whatsapp_credentials WHERE client_id = ?').get(clientId);
        const client = await db.prepare('SELECT ai_daily_limit, meta_tier_limit FROM clients WHERE id = ?').get(clientId);
        sendJson(res, 200, {
          openaiSet: !!openai,
          whatsappSet: !!whatsapp,
          aiDailyLimit: client?.ai_daily_limit || 0,
          metaTierLimit: client?.meta_tier_limit || 0
        });
      } else if (apiPath.match(/^clients\/([^\/]+)\/credentials\/openai$/) && req.method === 'POST') {
        const clientId = apiPath.split('/')[1];
        const body = JSON.parse(await readBody(req));
        const { apiKey, assistantId, commandPrompt } = body;
        const apiKeyEnc = encryptSecret(apiKey);
        
        await db.prepare('DELETE FROM openai_credentials WHERE client_id = ?').run(clientId);
        await db.prepare('INSERT INTO openai_credentials (client_id, api_key_enc, assistant_id, command_prompt, created_at) VALUES (?, ?, ?, ?, ?)')
          .run(clientId, apiKeyEnc, assistantId, commandPrompt, nowIso());
        
        sendJson(res, 200, { ok: true });
      } else if (apiPath.match(/^clients\/([^\/]+)\/credentials\/whatsapp$/) && req.method === 'POST') {
        const clientId = apiPath.split('/')[1];
        const body = JSON.parse(await readBody(req));
        const { token, phoneNumberId, cloudNumber, businessId } = body;
        const tokenEnc = encryptSecret(token);
        
        await db.prepare('DELETE FROM whatsapp_credentials WHERE client_id = ?').run(clientId);
        await db.prepare('INSERT INTO whatsapp_credentials (client_id, token_enc, phone_number_id, cloud_number, business_id, created_at) VALUES (?, ?, ?, ?, ?, ?)')
          .run(clientId, tokenEnc, phoneNumberId, cloudNumber, businessId, nowIso());
        
        sendJson(res, 200, { ok: true });
      } else if (apiPath.match(/^clients\/([^\/]+)\/credentials\/limits$/) && req.method === 'POST') {
        const clientId = apiPath.split('/')[1];
        const body = JSON.parse(await readBody(req));
        const { aiDailyLimit, metaTierLimit } = body;
        
        await db.prepare('UPDATE clients SET ai_daily_limit = ?, meta_tier_limit = ? WHERE id = ?')
          .run(parseInt(aiDailyLimit, 10), parseInt(metaTierLimit, 10), clientId);
        
        sendJson(res, 200, { ok: true });
      } else {
        sendJson(res, 404, { error: 'API endpoint not found.' });
      }
    } else {
      sendJson(res, 404, { error: 'Not Found' });
    }
  } catch (error) {
    console.error('[SERVER] Erro na requisição:', error);
    sendJson(res, 500, { error: 'Internal Server Error' });
  }
};

async function refreshTemplateStatuses() {
  try {
    const templates = await db.prepare(
      'SELECT t.id, t.name, wc.token_enc, wc.business_id FROM message_templates t JOIN whatsapp_credentials wc ON t.client_id = wc.client_id WHERE t.status = ?',
    ).all('PENDING');

    for (const template of templates) {
      try {
        const token = decryptSecret(template.token_enc);
        const response = await fetch(
          `https://graph.facebook.com/v20.0/${template.business_id}/message_templates?name=${template.name}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const data = await response.json();

        if (data.data && data.data.length > 0) {
          const remoteTemplate = data.data[0];
          await db.prepare('UPDATE message_templates SET status = ?, quality_score = ? WHERE id = ?').run(
            remoteTemplate.status,
            remoteTemplate.quality_score?.score || 'UNKNOWN',
            template.id,
          );
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

const server = http.createServer(requestHandler);

if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => {
    console.log(`ClikPro WhatsApp App rodando na porta ${PORT}`);
  });
}

module.exports = requestHandler;
