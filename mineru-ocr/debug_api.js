const fs = require('fs');
const https = require('https');
const path = require('path');

const content = fs.readFileSync('config/.env', 'utf8');
const match = content.match(/MINERU_API_TOKEN=(.+)/);
const token = match[1].trim();
console.log('Token length:', token.length);

const apiBase = 'https://mineru.net/api/v4';

// Use the exact same request as convert.js
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
console.log('Body length:', Buffer.byteLength(bodyStr));
console.log('Body bytes:', Buffer.byteLength(bodyStr), 'chars:', bodyStr.length);
console.log('Body preview:', bodyStr.substring(0, 100));

// Check if there are any invisible characters
console.log('Body char codes:', [...bodyStr].slice(0, 50).map(c => c.charCodeAt(0)));

// Compare with a simple ASCII body
const simpleBody = JSON.stringify({test: 'hello'});
console.log('Simple body bytes:', Buffer.byteLength(simpleBody), 'chars:', simpleBody.length);

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

console.log('Request headers:', JSON.stringify(options.headers));

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