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

// Utiliza a API fetch nativa do Node 18+. A versão mínima suportada é
// Node.js 18, que já possui `global.fetch`. Se estiver em uma versão
// anterior, atualize seu Node. Não são necessárias dependências extras.

const fetch = global.fetch;

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

/**
 * Envia uma mensagem para um telefone via API do WhatsApp Cloud.
 * Necessita das variáveis de ambiente WHATSAPP_TOKEN e
 * WHATSAPP_PHONE_NUMBER_ID.
 *
 * @param {string} phone Destinatário em formato E.164 (sem '+').
 * @param {string} message Texto a ser enviado.
 */
async function sendWhatsAppMessage(phone, message) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
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
function generateAIResponse(userMessage) {
  const text = (userMessage || '').toLowerCase();
  if (text.includes('preço') || text.includes('preco') || text.includes('valor')) {
    return 'Os planos variam de acordo com suas necessidades. Podemos conversar mais para entender o melhor para você.';
  }
  if (text.includes('olá') || text.includes('oi') || text.includes('bom dia') || text.includes('boa tarde') || text.includes('boa noite')) {
    return 'Olá! Como posso te ajudar hoje?';
  }
  // Resposta padrão
  return 'Obrigado pela mensagem! Em breve um de nossos consultores entrará em contato.';
}

/**
 * Trata uma mensagem recebida pelo webhook. Atualiza o histórico
 * e envia uma resposta automática via WhatsApp.
 *
 * @param {string} phone Identificador do usuário/telefone.
 * @param {string} text Conteúdo da mensagem do usuário.
 */
function handleIncomingMessage(phone, text) {
  // Registrar mensagem do usuário
  messages.push({ role: 'user', content: text, phone });
  // Gerar resposta com IA simples
  const aiResponse = generateAIResponse(text);
  messages.push({ role: 'ai', content: aiResponse, phone });
  // Enviar mensagem via WhatsApp
  sendWhatsAppMessage(phone, aiResponse);
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

  // Endpoint de verificação do webhook (GET /webhook)
  if (req.method === 'GET' && path === 'webhook') {
    const verifyToken = process.env.VERIFY_TOKEN;
    const mode = parsedUrl.query['hub.mode'];
    const token = parsedUrl.query['hub.verify_token'];
    const challenge = parsedUrl.query['hub.challenge'];
    if (mode && token && mode === 'subscribe' && token === verifyToken) {
      console.log('[WEBHOOK] Verificado com sucesso');
      res.writeHead(200);
      res.end(challenge);
    } else {
      res.writeHead(403);
      res.end('Token inválido');
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
        if (Array.isArray(json.entry)) {
          json.entry.forEach((entry) => {
            if (Array.isArray(entry.changes)) {
              entry.changes.forEach((change) => {
                const value = change.value || {};
                if (value.messages && value.messages[0] && value.messages[0].from) {
                  const phone = value.messages[0].from;
                  const msg = value.messages[0].text && value.messages[0].text.body;
                  if (msg) {
                    handleIncomingMessage(phone, msg);
                  }
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
    const contentType = req.headers['content-type'] || '';
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        let phone = '';
        let message = '';
        let attachments = [];
        if (contentType.includes('multipart/form-data')) {
          const boundaryMatch = contentType.match(/boundary=(.+)$/);
          const boundary = boundaryMatch ? boundaryMatch[1] : '';
          const payload = parseMultipartFormData(body, boundary);
          phone = payload.fields.phone || '';
          message = payload.fields.message || '';
          attachments = payload.files.map((file) => ({
            name: file.name,
            type: file.type,
          }));
        } else {
          const payload = JSON.parse(body);
          phone = payload.phone;
          message = payload.message;
        }
        if (!phone || !message) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'phone e message são obrigatórios' }));
          return;
        }
        messages.push({ role: 'agent', content: message, phone, attachments });
        sendWhatsAppMessage(phone, message).then(() => {
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

// Definir porta e iniciar servidor
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`ClikPro WhatsApp App rodando na porta ${PORT}`);
});
