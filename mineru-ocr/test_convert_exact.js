// Test that mimics exactly what convert.js does
const https = require('https');
const fs = require('fs');
const path = require('path');

// Load config exactly like convert.js does
const skillRoot = path.join(__dirname); // same dir as convert.js scripts
const envPath = path.join(skillRoot, 'config', '.env');
console.log('Skill root:', skillRoot);
console.log('Env path:', envPath);
console.log('Env exists:', fs.existsSync(envPath));

function readTextFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return '';
  }
}

function sanitizeConfigValue(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const lowered = text.toLowerCase();
  if (lowered === 'your_token_here' ||
      lowered === 'your_mineru_api_token_here' ||
      text.indexOf('example') > -1) {
    return '';
  }
  return text;
}

function loadConfig(skillRoot) {
  const envPath = path.join(skillRoot, 'config', '.env');
  const config = { __envPath: envPath, __envExists: false };
  if (!fs.existsSync(envPath)) return config;
  config.__envExists = true;
  const content = readTextFile(envPath);
  if (!content) throw new Error('无法读取配置文件: ' + envPath);
  const lines = content.match(/[^\r\n]+/g) || [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const equalIndex = trimmed.indexOf('=');
    if (equalIndex <= 0) continue;
    const key = trimmed.substring(0, equalIndex).trim();
    let value = trimmed.substring(equalIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    config[key] = value;
  }
  return config;
}

const config = loadConfig(skillRoot);
console.log('Config keys:', Object.keys(config));
console.log('Token from config:', config.MINERU_API_TOKEN ? config.MINERU_API_TOKEN.substring(0, 30) + '...' : 'NOT FOUND');

const apiToken = sanitizeConfigValue(config.MINERU_API_TOKEN);
console.log('Sanitized token:', apiToken ? apiToken.substring(0, 30) + '...' : 'EMPTY');

// Now make the exact same HTTP request as convert.js
const dataId = 'convert_1777307871144_6hdu33jq3';
const fileName = '李志萍律师拒执罪刑事判决书.pdf';
const reqBody = {
  enable_formula: false,
  language: 'ch',
  enable_table: true,
  model_version: 'pipeline',
  files: [{
    name: fileName,
    is_ocr: true,
    data_id: dataId
  }]
};

const bodyStr = JSON.stringify(reqBody);
console.log('Body:', bodyStr);

const API_BASE = 'https://mineru.net/api/v4';

const url = new URL(API_BASE + '/file-urls/batch');
const options = {
  hostname: url.hostname,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + apiToken,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(bodyStr)
  }
};

console.log('Options:', JSON.stringify({hostname: options.hostname, path: options.path, method: options.method, headers: {Authorization: options.headers.Authorization ? 'Bearer [TOKEN]' : 'MISSING', 'Content-Type': options.headers['Content-Type'], 'Content-Length': options.headers['Content-Length']}}));

const req = https.request(options, (res) => {
  const chunks = [];
  res.on('data', c => chunks.push(c));
  res.on('end', () => {
    const body = Buffer.concat(chunks).toString();
    console.log('Status:', res.statusCode);
    console.log('Response:', body.substring(0, 500));
  });
});
req.on('error', e => console.error('Error:', e.message));
req.write(bodyStr);
req.end();