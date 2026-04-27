const https = require('https');
const fs = require('fs');

const content = fs.readFileSync('config/.env', 'utf8');
const match = content.match(/MINERU_API_TOKEN=(.+)/);
const token = match[1].trim();

function httpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() });
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('Request timeout')); });
    if (body) req.write(body);
    req.end();
  });
}

async function test() {
  // Test: Get upload URL and check all fields in response
  const reqBody = {
    enable_formula: false,
    language: 'ch',
    enable_table: true,
    model_version: 'pipeline',
    files: [{ name: 'test.pdf', is_ocr: true, data_id: 'test123' }]
  };
  const bodyStr = JSON.stringify(reqBody);
  const url = new URL('https://mineru.net/api/v4/file-urls/batch');

  const resp = await httpRequest({
    hostname: url.hostname,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(bodyStr)
    }
  }, bodyStr);

  console.log('Full API response:');
  const data = JSON.parse(resp.body);
  console.log(JSON.stringify(data, null, 2));

  // Check if there's a separate upload endpoint or different flow
  // Try /extract/upload endpoint
  console.log('\n\nTrying /extract/upload endpoint...');
  const uploadUrl = new URL('https://mineru.net/api/v4/extract/upload');
  const uploadResp = await httpRequest({
    hostname: uploadUrl.hostname,
    path: uploadUrl.pathname,
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(bodyStr)
    }
  }, bodyStr);
  console.log('Status:', uploadResp.status, 'Body:', uploadResp.body.substring(0, 300));
}

test().catch(console.error);