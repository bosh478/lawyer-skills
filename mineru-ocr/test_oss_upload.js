const https = require('https');
const fs = require('fs');
const path = require('path');

// Read the token
const content = fs.readFileSync('config/.env', 'utf8');
const match = content.match(/MINERU_API_TOKEN=(.+)/);
const token = match[1].trim();

// First get a fresh upload URL
const reqBody = {
  enable_formula: false,
  language: 'ch',
  enable_table: true,
  model_version: 'pipeline',
  files: [{
    name: 'test.pdf',
    is_ocr: true,
    data_id: 'test123'
  }]
};

const bodyStr = JSON.stringify(reqBody);
const url = new URL('https://mineru.net/api/v4/file-urls/batch');
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

function httpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() });
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('Request timeout')); });
    if (body) req.write(body);
    req.end();
  });
}

async function test() {
  // Get upload URL
  const resp = await httpRequest(options, bodyStr);
  console.log('API response:', resp.body.substring(0, 300));

  const data = JSON.parse(resp.body);
  const uploadURL = data.data.file_urls[0];
  console.log('Upload URL:', uploadURL.substring(0, 150) + '...');

  // Create a small test file
  const testContent = 'Hello, this is a test PDF content simulation';
  const testBuffer = Buffer.from(testContent, 'utf8');

  // Test 1: PUT with explicit Content-Length and Content-Type
  const putOpts = new URL(uploadURL);
  const putOptions1 = {
    hostname: putOpts.hostname,
    path: putOpts.pathname + '?' + putOpts.searchParams.toString(),
    method: 'PUT',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': testBuffer.length
    }
  };

  console.log('\nTest 1: PUT with Content-Length and Content-Type only');
  const r1 = await httpRequest(putOptions1, testBuffer);
  console.log('Status:', r1.status, 'Body:', r1.body.substring(0, 200));

  // Test 2: PUT without Content-Length (chunked)
  const putOptions2 = {
    hostname: putOpts.hostname,
    path: putOpts.pathname + '?' + putOpts.searchParams.toString(),
    method: 'PUT',
    headers: {
      'Content-Type': 'application/octet-stream'
    }
  };

  console.log('\nTest 2: PUT without Content-Length (chunked)');
  const r2 = await httpRequest(putOptions2, testBuffer);
  console.log('Status:', r2.status, 'Body:', r2.body.substring(0, 200));
}

test().catch(console.error);