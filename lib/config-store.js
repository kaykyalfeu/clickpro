const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dataDir = path.join(__dirname, '..', 'data');
const logsDir = path.join(__dirname, '..', 'logs');
const configPath = path.join(dataDir, 'config.enc.json');
const keyPath = path.join(dataDir, '.localkey');
const webhookTokenPath = path.join(dataDir, 'verify_token.txt');

const REQUIRED_FIELDS = {
  openai: ['apiKey', 'assistantId', 'commandPrompt'],
  whatsapp: ['token'],
};

function ensureDirectories() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(logsDir, { recursive: true });
}

function getKey() {
  ensureDirectories();
  if (fs.existsSync(keyPath)) {
    return Buffer.from(fs.readFileSync(keyPath, 'utf8'), 'base64');
  }
  const key = crypto.randomBytes(32);
  fs.writeFileSync(keyPath, key.toString('base64'), { mode: 0o600 });
  return key;
}

function getWebhookToken() {
  ensureDirectories();
  if (fs.existsSync(webhookTokenPath)) {
    return fs.readFileSync(webhookTokenPath, 'utf8').trim();
  }
  const token = crypto.randomBytes(16).toString('hex');
  fs.writeFileSync(webhookTokenPath, token, { mode: 0o600 });
  return token;
}

function encryptSecret(value, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    value: encrypted.toString('base64'),
  };
}

function writeJsonAtomic(targetPath, data) {
  const dir = path.dirname(targetPath);
  const tempPath = path.join(dir, `.${path.basename(targetPath)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
  fs.renameSync(tempPath, targetPath);
}

function normalizePublicUrl(input) {
  const trimmed = (input || '').trim();
  if (!trimmed) {
    return '';
  }
  if (!trimmed.startsWith('https://')) {
    throw new Error('Webhook URL deve começar com https://');
  }
  const sanitized = trimmed.replace(/\/+$/, '');
  if (/^https:\/\/(localhost|127\.0\.0\.1)/i.test(sanitized)) {
    throw new Error('Webhook URL não pode ser localhost.');
  }
  return sanitized;
}

function decryptSecret(payload, key) {
  const iv = Buffer.from(payload.iv, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');
  const encrypted = Buffer.from(payload.value, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

function hasRequiredFields(config) {
  if (!config) {
    return false;
  }
  return Object.entries(REQUIRED_FIELDS).every(([section, fields]) =>
    fields.every((field) => config[section] && config[section][field]),
  );
}

function getConfig() {
  if (!fs.existsSync(configPath)) {
    return null;
  }
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const key = getKey();
  return {
    openai: {
      apiKey: raw.openai?.apiKey ? decryptSecret(raw.openai.apiKey, key) : '',
      assistantId: raw.openai?.assistantId || '',
      commandPrompt: raw.openai?.commandPrompt || '',
    },
    whatsapp: {
      token: raw.whatsapp?.token ? decryptSecret(raw.whatsapp.token, key) : '',
      phoneNumberId: raw.whatsapp?.phoneNumberId || '',
      cloudNumber: raw.whatsapp?.cloudNumber || '',
    },
    webhook: {
      publicUrl: raw.webhook?.publicUrl || '',
    },
  };
}

function getStatus() {
  const config = getConfig();
  return hasRequiredFields(config) ? 'READY' : 'NEEDS_SETUP';
}

function sanitizeConfigForClient(config) {
  const safeConfig = config || { openai: {}, whatsapp: {}, webhook: {} };
  return {
    status: getStatus(),
    openai: {
      assistantId: safeConfig.openai.assistantId || '',
      commandPrompt: safeConfig.openai.commandPrompt || '',
      apiKeySet: Boolean(safeConfig.openai.apiKey),
    },
    whatsapp: {
      phoneNumberId: safeConfig.whatsapp.phoneNumberId || '',
      cloudNumber: safeConfig.whatsapp.cloudNumber || '',
      tokenSet: Boolean(safeConfig.whatsapp.token),
    },
    webhook: {
      verifyToken: getWebhookToken(),
      publicUrl: safeConfig.webhook.publicUrl || '',
    },
  };
}

function saveConfig(partial) {
  const existing = getConfig() || { openai: {}, whatsapp: {}, webhook: {} };
  const next = {
    openai: {
      apiKey: partial.openai?.apiKey || existing.openai.apiKey || '',
      assistantId: partial.openai?.assistantId || existing.openai.assistantId || '',
      commandPrompt: partial.openai?.commandPrompt || existing.openai.commandPrompt || '',
    },
    whatsapp: {
      token: partial.whatsapp?.token || existing.whatsapp.token || '',
      phoneNumberId: partial.whatsapp?.phoneNumberId || existing.whatsapp.phoneNumberId || '',
      cloudNumber: partial.whatsapp?.cloudNumber || existing.whatsapp.cloudNumber || '',
    },
    webhook: {
      publicUrl: normalizePublicUrl(partial.webhook?.publicUrl || existing.webhook.publicUrl || ''),
    },
  };

  if (!hasRequiredFields(next)) {
    throw new Error('Configuração incompleta.');
  }

  const key = getKey();
  const payload = {
    openai: {
      apiKey: encryptSecret(next.openai.apiKey, key),
      assistantId: next.openai.assistantId,
      commandPrompt: next.openai.commandPrompt,
    },
    whatsapp: {
      token: encryptSecret(next.whatsapp.token, key),
      phoneNumberId: next.whatsapp.phoneNumberId,
      cloudNumber: next.whatsapp.cloudNumber,
    },
    webhook: {
      publicUrl: next.webhook.publicUrl,
    },
  };
  writeJsonAtomic(configPath, payload);
  return next;
}

module.exports = {
  ensureDirectories,
  getConfig,
  getStatus,
  sanitizeConfigForClient,
  saveConfig,
  getWebhookToken,
};
