const db = require('../../database');

function getSetting(key) {
  return db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value ?? null;
}

function saveSetting(key, value) {
  db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run(key, value);
}

function getConfig() {
  let config;
  try {
    config = JSON.parse(getSetting('provider_config') || '{}');
  } catch {
    config = {};
  }
  return {
    baseUrl: config.baseUrl || '',
    model: config.model || '',
    apiKey: config.apiKey || ''
  };
}

function publicConfig() {
  const c = getConfig();
  return {
    baseUrl: c.baseUrl,
    model: c.model,
    hasKey: !!c.apiKey,
    maskedKey: c.apiKey ? '••••••••' : ''
  };
}

function validateConfig(c) {
  if (!c || typeof c !== 'object') throw new Error('Configuration required');
  if (typeof c.baseUrl !== 'string' || !c.baseUrl.trim()) throw new Error('API endpoint is required');
  if (typeof c.model !== 'string' || !c.model.trim()) throw new Error('Model ID is required');

  let u;
  try {
    u = new URL(c.baseUrl.trim());
  } catch {
    throw new Error('Invalid API endpoint URL');
  }
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Endpoint must use HTTP or HTTPS');
  if (u.username || u.password) throw new Error('Do not embed credentials in the endpoint URL');
  if (c.apiKey !== undefined && typeof c.apiKey !== 'string') throw new Error('Invalid API key');
}

function saveConfig(c) {
  validateConfig(c);
  const old = getConfig();
  const config = {
    baseUrl: c.baseUrl.trim().replace(/\/+$/, ''),
    model: c.model.trim(),
    apiKey: c.apiKey === '••••••••' ? old.apiKey : (c.apiKey || '')
  };
  saveSetting('provider_config', JSON.stringify(config));
  return publicConfig();
}

async function testConnection() {
  const c = getConfig();
  if (!c.baseUrl) throw new Error('Configure an API endpoint first');

  const endpoint = c.baseUrl.replace(/\/+$/, '') + '/models';
  const headers = {};
  if (c.apiKey) headers.Authorization = `Bearer ${c.apiKey}`;

  const response = await fetch(endpoint, {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(15000)
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Provider returned HTTP ${response.status}: ${text.slice(0,250)}`);
  }

  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error('Provider response was not valid JSON');
  }

  const modelCount = Array.isArray(result.data) ? result.data.length : null;
  return {
    success: true,
    message: 'Endpoint connection successful',
    model: c.model,
    modelsListed: modelCount
  };
}

module.exports = { getConfig, publicConfig, saveConfig, testConnection };
