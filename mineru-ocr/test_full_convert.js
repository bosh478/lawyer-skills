const fs = require('fs');
const https = require('https');
const path = require('path');

const content = fs.readFileSync('config/.env', 'utf8');
const match = content.match(/MINERU_API_TOKEN=(.+)/);
const token = match[1].trim();
console.log('Token length:', token.length);

const apiBase = 'https://mineru.net/api/v4';

// Test file: the actual PDF
const testFile = 'C:/Users/汤康康/Desktop/李志萍律师拒执罪刑事判决书.pdf';
console.log('File exists:', fs.existsSync(testFile));

if (!fs.existsSync(testFile)) {
  // Try with mangled path (bash stripped)
  const mangled = 'C:Users' + testFile.substring(10).replace(/\\/g, '/');
  console.log('Mangled path exists:', fs.existsSync(mangled));
}

const dataId = 'convert_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);

const reqBody = {
  enable_formula: false,
  language: 'ch',
  enable_table: true,
  model_version: 'pipeline',
  files: [{
    name: '李志萍律师拒执罪刑事判决书.pdf',
    is_ocr: true,
    data_id: dataId
  }]
};

const bodyStr = JSON.stringify(reqBody);
console.log('Request body:', bodyStr.substring(0, 300));

const url = new URL(apiBase + '/file-urls/batch');
const options = {
  hostname: url.hostname,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(bodyStr)
  }
};

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