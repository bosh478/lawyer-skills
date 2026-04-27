const fs = require('fs');
const https = require('https');

const content = fs.readFileSync('config/.env', 'utf8');
const match = content.match(/MINERU_API_TOKEN=(.+)/);
const token = match[1].trim();
console.log('Token length:', token.length);

const apiBase = 'https://mineru.net/api/v4';

async function testFormat(label, reqBody) {
  const bodyStr = JSON.stringify(reqBody);
  return new Promise((resolve) => {
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
        console.log(`[${label}] Status: ${res.statusCode}`);
        console.log(`[${label}] Response: ${body.substring(0, 300)}`);
        console.log('---');
        resolve();
      });
    });
    req.on('error', e => { console.error('Error:', e.message); resolve(); });
    req.write(bodyStr);
    req.end();
  });
}

async function run() {
  // Test 1: files as array of {name, is_ocr, data_id} - current format
  await testFormat('name+is_ocr+data_id', {
    enable_formula: false,
    language: 'ch',
    enable_table: true,
    model_version: 'pipeline',
    files: [{ name: 'test.pdf', is_ocr: true, data_id: 'test123' }]
  });

  await new Promise(r => setTimeout(r, 1000));

  // Test 2: files as array of {file_path, is_ocr, data_id}
  await testFormat('file_path+is_ocr+data_id', {
    enable_formula: false,
    language: 'ch',
    enable_table: true,
    model_version: 'pipeline',
    files: [{ file_path: 'test.pdf', is_ocr: true, data_id: 'test123' }]
  });

  await new Promise(r => setTimeout(r, 1000));

  // Test 3: files as array of {file_name, is_ocr, data_id}
  await testFormat('file_name+is_ocr+data_id', {
    enable_formula: false,
    language: 'ch',
    enable_table: true,
    model_version: 'pipeline',
    files: [{ file_name: 'test.pdf', is_ocr: true, data_id: 'test123' }]
  });

  await new Promise(r => setTimeout(r, 1000));

  // Test 4: with page_ranges
  await testFormat('with_page_ranges', {
    enable_formula: false,
    language: 'ch',
    enable_table: true,
    model_version: 'pipeline',
    files: [{ name: 'test.pdf', is_ocr: true, data_id: 'test123', page_ranges: '1-10' }]
  });

  await new Promise(r => setTimeout(r, 1000));

  // Test 5: files as a JSON string (some APIs expect serialized JSON in a string field)
  await testFormat('files_as_string', {
    enable_formula: false,
    language: 'ch',
    enable_table: true,
    model_version: 'pipeline',
    files: JSON.stringify([{ name: 'test.pdf', is_ocr: true, data_id: 'test123' }])
  });
}

run();