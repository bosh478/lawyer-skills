// MinerU PDF 转 Markdown Converter
// Windows-compatible version (pure Node.js)
// 默认 auto 模式：无 Token 时使用免费接口，有 Token 时使用标准 API

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawn } = require('child_process');
const crypto = require('crypto');

// ============ Path utilities ============
function resolveSkillRoot() {
  // Navigate from script location to skill root
  const scriptDir = __dirname;
  return path.dirname(scriptDir); // goes up from /scripts to /mineru-ocr
}

function resolveHomeDir() {
  if (process.platform === 'win32') {
    return process.env.USERPROFILE || process.env.HOME || '';
  }
  return process.env.HOME || '';
}

function normalizeWindowsPath(source) {
  // On Windows, bash strips backslashes from "C:\path\file.pdf"
  // and node receives "C:pathfile.pdf". Detect by [drive]:[non-separator] pattern.
  if (process.platform === 'win32') {
    const m = source.match(/^([A-Za-z]:)([^/\\])/);
    if (m) {
      source = m[1] + '/' + m[2];
      source = source.replace(/\\/g, '/');
    }
  }
  return source;
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

function parseBoolean(value, fallback) {
  if (typeof value === 'undefined' || value === null || String(value).trim() === '') {
    return fallback;
  }
  const lowered = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].indexOf(lowered) > -1) return true;
  if (['false', '0', 'no', 'off'].indexOf(lowered) > -1) return false;
  return fallback;
}

function parseInteger(value, fallback) {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? fallback : parsed;
}

function normalizePageRanges(value) {
  return String(value || '').trim().replace(/\s+/g, '');
}

function resolveTokenModelVersion(configuredValue, sourceType) {
  if (sourceType === 'remote_html_url') return 'MinerU-HTML';
  const value = String(configuredValue || '').trim();
  if (value === 'vlm') return 'vlm';
  return 'pipeline';
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function hasKnownExtension(name, exts) {
  const lowered = String(name || '').toLowerCase();
  for (let i = 0; i < exts.length; i++) {
    if (lowered.endsWith('.' + exts[i])) return true;
  }
  return false;
}

function extractPathWithoutQuery(url) {
  return String(url || '').split('?')[0].split('#')[0];
}

function deriveNameFromUrl(url) {
  const p = extractPathWithoutQuery(url);
  const parts = p.split('/');
  return parts[parts.length - 1] || 'remote-document';
}

function sanitizeFileName(name, fallback) {
  const cleaned = String(name || '')
    .replace(/[^0-9A-Za-z._\-一-鿿]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || fallback;
}

function isHtmlLikeUrl(url) {
  const p = extractPathWithoutQuery(url).toLowerCase();
  if (p.endsWith('.html') || p.endsWith('.htm')) return true;
  const docExts = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'png', 'jpg', 'jpeg', 'jp2', 'webp', 'gif', 'bmp', 'xls', 'xlsx'];
  return !hasKnownExtension(p, docExts);
}

function zeroPad(num) {
  return num < 10 ? '0' + num : String(num);
}

function buildArchiveSubDir(skillRoot, baseNameNoExt) {
  const now = new Date();
  const dateStr = now.getFullYear() + zeroPad(now.getMonth() + 1) + zeroPad(now.getDate());
  const timeStr = zeroPad(now.getHours()) + zeroPad(now.getMinutes()) + zeroPad(now.getSeconds());
  return path.join(skillRoot, 'archive', `${dateStr}_${timeStr}_${baseNameNoExt}`);
}

function getTmpDir() {
  if (process.platform === 'win32') {
    return process.env.TEMP || process.env.TMP || path.join(os.tmpdir());
  }
  return os.tmpdir();
}

function mkTempDir(prefix) {
  const tmpDir = getTmpDir();
  const name = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
  const fullPath = path.join(tmpDir, name);
  fs.mkdirSync(fullPath, { recursive: true });
  return fullPath;
}

// ============ Native CLI (Windows) ============
function findNativeCli() {
  if (process.platform !== 'win32') return '';
  // Check common Python package locations for the mineru CLI binary
  const possiblePaths = [
    path.join(process.env.APPDATA || '', 'Python', 'Python314', 'Lib', 'site-packages', 'mineru_open_api', 'bin', 'mineru-open-api-windows-amd64.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python314', 'Lib', 'site-packages', 'mineru_open_api', 'bin', 'mineru-open-api-windows-amd64.exe'),
    'C:\\Program Files\\Python314\\Lib\\site-packages\\mineru_open_api\\bin\\mineru-open-api-windows-amd64.exe',
  ];
  // Also try using Python to find the package location
  try {
    const pythonPath = execSync('python -c "import mineru_open_api; print(mineru_open_api.__path__[0])" 2>nul', { encoding: 'utf8', shell: true }).trim();
    if (pythonPath) {
      possiblePaths.unshift(path.join(pythonPath, 'bin', 'mineru-open-api-windows-amd64.exe'));
    }
  } catch (e) {}
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return '';
}

async function convertWithNativeCli(source, info, skillRoot, log) {
  const cliPath = findNativeCli();
  if (!cliPath) {
    throw new Error('Native CLI not found');
  }

  const workDir = mkTempDir('mineru_native');
  const outputFile = path.join(workDir, 'output.md');
  const outputDir = path.join(workDir, 'out');

  try {
    // Normalize Windows path for CLI
    let filePath = source;
    if (process.platform === 'win32') {
      filePath = normalizeWindowsPath(filePath);
    }

    log('Using native MinerU CLI for token conversion...', 2);

    // Run the native CLI extract command
    // Quote the CLI path and file paths to handle spaces on Windows
    const quotedCli = '"' + cliPath + '"';
    const quotedFile = '"' + filePath + '"';
    const quotedOut = '"' + outputDir + '"';
    const cmd = quotedCli + ' extract ' + quotedFile + ' -o ' + quotedOut;
    const result = await new Promise((resolve, reject) => {
      const proc = spawn(cmd, [], { shell: true, windowsHide: true });
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (data) => { stdout += data.toString(); });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });
      proc.on('close', (code) => {
        if (code === 0) resolve({ code, stdout, stderr });
        else reject(new Error(`Native CLI exited with code ${code}: ${stderr}`));
      });
      proc.on('error', reject);
    });

    // Find the output markdown
    const outFiles = findFiles(outputDir, /\.md$/);
    if (outFiles.length > 0) {
      const mdFile = path.join(workDir, 'full.md');
      fs.copyFileSync(outFiles[0], mdFile);
      return finalizeResult(workDir, skillRoot, info, mdFile, {
        mode: 'token',
        sourceFile: source,
        detail: { method: 'native_cli' }
      }, log);
    }

    // If no markdown found but we got stdout, use stdout
    if (result.stdout.trim()) {
      const mdFile = path.join(workDir, 'full.md');
      writeTextFile(mdFile, result.stdout);
      return finalizeResult(workDir, skillRoot, info, mdFile, {
        mode: 'token',
        sourceFile: source,
        detail: { method: 'native_cli_stdout' }
      }, log);
    }

    throw new Error('Native CLI produced no output');
  } finally {
    rmrf(workDir);
  }
}

// ============ Shell utilities ============
function shell(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', shell: true, maxBuffer: 50 * 1024 * 1024 }).trim();
  } catch (e) {
    return '';
  }
}

function shellQuote(value) {
  // Windows cmd quoting
  return '"' + String(value).replace(/"/g, '""') + '"';
}

function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (e) {
    return 0;
  }
}

function getPdfPageCount(filePath) {
  try {
    // Use pdf-parse via node if available, otherwise try external tool
    const result = execSync(`pdfinfo "${filePath}" 2>nul || echo "0"`, { encoding: 'utf8', shell: true });
    const match = result.match(/Pages:\s*(\d+)/);
    if (match) return parseInt(match[1], 10);
  } catch (e) {
    // pdfinfo not available
  }
  return null;
}

function copyFile(src, dest) {
  fs.copyFileSync(src, dest);
}

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function rmrf(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function findFiles(dir, pattern) {
  const results = [];
  function walk(d) {
    try {
      const items = fs.readdirSync(d);
      for (const item of items) {
        const full = path.join(d, item);
        try {
          const stat = fs.statSync(full);
          if (stat.isDirectory()) {
            walk(full);
          } else if (pattern.test(item)) {
            results.push(full);
          }
        } catch (e) {}
      }
    } catch (e) {}
  }
  walk(dir);
  return results;
}

function readTextFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return '';
  }
}

function writeTextFile(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function writeJsonFile(filePath, payload) {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

// ============ Config loading ============
function loadConfig(skillRoot) {
  const envPath = path.join(skillRoot, 'config', '.env');
  const config = { __envPath: envPath, __envExists: false };

  if (!fs.existsSync(envPath)) {
    return config;
  }

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

function readOfficialCliToken() {
  const homeDir = resolveHomeDir();
  if (!homeDir) return '';

  const yamlPath = path.join(homeDir, '.mineru', 'config.yaml');
  if (!fs.existsSync(yamlPath)) return '';

  const yamlContent = readTextFile(yamlPath);
  if (!yamlContent) return '';

  const patterns = [
    /^\s*token\s*:\s*["']?([^"'#\r\n]+)["']?\s*$/m,
    /^\s*api_token\s*:\s*["']?([^"'#\r\n]+)["']?\s*$/m,
    /^\s*mineru_token\s*:\s*["']?([^"'#\r\n]+)["']?\s*$/m
  ];

  for (const pattern of patterns) {
    const match = yamlContent.match(pattern);
    if (match && match[1]) {
      const token = sanitizeConfigValue(match[1]);
      if (token) return token;
    }
  }
  return '';
}

function resolveApiToken(config) {
  const configuredToken = sanitizeConfigValue(config.MINERU_API_TOKEN);
  if (configuredToken) return configuredToken;

  const envToken = sanitizeConfigValue(process.env.MINERU_API_TOKEN || '');
  if (envToken) return envToken;

  const fallbackEnvToken = sanitizeConfigValue(process.env.MINERU_TOKEN || '');
  if (fallbackEnvToken) return fallbackEnvToken;

  return readOfficialCliToken();
}

// ============ HTTP utilities ============
function httpRequest(url, options) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.request(url, options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString();
        resolve({ status: res.statusCode, headers: res.headers, body });
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('Request timeout')); });
    if (options.body) req.write(options.body);
    req.end();
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      const stream = fs.createWriteStream(destPath);
      res.pipe(stream);
      stream.on('finish', () => resolve(res.statusCode));
      stream.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Download timeout')); });
  });
}

// ============ Help messages ============
function buildTokenSetupHelp(skillRoot, reason) {
  let msg = '\n===============================================\n';
  msg += '请先配置 MinerU Token\n';
  msg += '===============================================\n';
  if (reason) msg += reason + '\n\n';
  msg += '当前默认使用免费接口，适合转换普通文件。\n';
  msg += '如需转换更大/更长的文档，请配置标准 API Token。\n\n';
  msg += '配置方法：\n';
  msg += '1. 获取 Token：https://mineru.net/apiManage/token\n\n';
  msg += '2. 告诉 AI："我的 MinerU Token 是 xxx"\n';
  msg += '(AI 会自动写入配置文件)\n';
  return msg;
}

function buildExpiredTokenHelp(skillRoot, httpStatus) {
  let msg = '\n===============================================\n';
  msg += 'MinerU API Token 已过期或无效\n';
  msg += '===============================================\n';
  msg += 'HTTP 状态: ' + httpStatus + '\n';
  msg += '当前接口将降级为免费接口\n';
  msg += '如需继续使用，请更新 Token\n';
  return msg;
}

function getAllowedExts(mode) {
  if (mode === 'light') {
    return ['pdf', 'docx', 'pptx', 'png', 'jpg', 'jpeg', 'jp2', 'webp', 'gif', 'bmp', 'xls', 'xlsx'];
  }
  return ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'png', 'jpg', 'jpeg'];
}

function buildSourceInfo(source, mode, skillRoot) {
  if (!source) throw new Error('未提供文件路径或 URL');

  // Normalize Windows paths mangled by bash (e.g. C:Usersfile.pdf -> C:/Users/file.pdf)
  source = normalizeWindowsPath(source);

  if (isHttpUrl(source)) {
    const sourceUrl = String(source).trim();
    const fileName = deriveNameFromUrl(sourceUrl);
    const dotIndex = fileName.lastIndexOf('.');
    const ext = dotIndex > -1 ? fileName.substring(dotIndex + 1).toLowerCase() : '';
    const htmlLike = isHtmlLikeUrl(sourceUrl);
    if (mode === 'light' && htmlLike) {
      throw new Error(buildTokenSetupHelp(skillRoot, '网页 URL 提取需要标准 Token API，免费接口不支持远程文档'));
    }
    const baseNameNoExt = dotIndex > -1 ? fileName.substring(0, dotIndex) : fileName || 'remote-document';
    return {
      sourceType: htmlLike ? 'remote_html_url' : 'remote_doc_url',
      sourceValue: sourceUrl,
      fileName: sanitizeFileName(fileName || baseNameNoExt, htmlLike ? 'web_page.html' : 'remote_document'),
      baseNameNoExt,
      ext,
      outputDir: process.cwd(),
      sizeBytes: null,
      pageCount: null
    };
  }

  const filePath = source;
  if (!fs.existsSync(filePath)) {
    throw new Error('文件不存在: ' + filePath);
  }

  const fileName = path.basename(filePath);
  const dotIndex = fileName.lastIndexOf('.');
  const ext = dotIndex > -1 ? fileName.substring(dotIndex + 1).toLowerCase() : '';
  const allowedExts = getAllowedExts(mode);

  if (allowedExts.indexOf(ext) === -1) {
    throw new Error(
      '当前' + (mode === 'light' ? '免费接口' : '标准 Token API') + '不支持该文件类型: ' + (ext || 'unknown') + '\n' +
      '支持格式: ' + allowedExts.join(', ')
    );
  }

  const sizeBytes = getFileSize(filePath);
  const pageCount = (ext === 'pdf') ? getPdfPageCount(filePath) : null;
  if (mode === 'light' && sizeBytes > 10 * 1024 * 1024) {
    throw new Error(buildTokenSetupHelp(skillRoot, '当前文件大小约 ' + (sizeBytes / 1024 / 1024).toFixed(2) + ' MB，已超过免费接口 10 MB 限制'));
  }
  if (mode === 'light' && pageCount && pageCount > 20) {
    throw new Error(buildTokenSetupHelp(skillRoot, '当前 PDF 共 ' + pageCount + ' 页，已超过免费接口 20 页限制'));
  }

  const baseNameNoExt = dotIndex > -1 ? fileName.substring(0, dotIndex) : fileName;
  const outputDir = path.dirname(path.resolve(filePath));

  return {
    sourceType: 'local_file',
    sourceValue: filePath,
    fileName,
    baseNameNoExt,
    ext,
    outputDir,
    sizeBytes,
    pageCount
  };
}

function collectRemoteImageUrls(markdownContent) {
  const urls = [];
  const seen = {};
  const regex = /!\[[^\]]*]\((https?:\/\/[^)\s]+)\)/g;
  let match;
  while ((match = regex.exec(markdownContent)) !== null) {
    const url = match[1];
    if (!seen[url]) {
      seen[url] = true;
      urls.push(url);
    }
  }
  return urls;
}

function safeAssetName(url, index) {
  const cleanUrl = url.split('?')[0].split('#')[0];
  const parts = cleanUrl.split('/');
  let fileName = parts[parts.length - 1] || ('image_' + zeroPad(index + 1) + '.bin');
  fileName = fileName.replace(/[^A-Za-z0-9._-]+/g, '_');
  if (!fileName) fileName = 'image_' + zeroPad(index + 1) + '.bin';
  return zeroPad(index + 1) + '_' + fileName;
}

function downloadRemoteImages(archiveSubDir, markdownContent) {
  const urls = collectRemoteImageUrls(markdownContent);
  const manifest = [];
  if (!urls.length) return manifest;

  const imageDir = path.join(archiveSubDir, 'images');
  mkdirp(imageDir);

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const assetName = safeAssetName(url, i);
    const outPath = path.join(imageDir, assetName);
    try {
      const httpCode = downloadFile(url, outPath);
      manifest.push({ url, archive_path: 'images/' + assetName, downloaded: true, http_code: 200 });
    } catch (e) {
      manifest.push({ url, archive_path: 'images/' + assetName, downloaded: false, http_code: 0 });
    }
  }
  return manifest;
}

function finalizeResult(workDir, skillRoot, info, mdFile, extraMeta, log) {
  const outputMdPath = path.join(info.outputDir, info.baseNameNoExt + '.md');
  fs.copyFileSync(mdFile, outputMdPath);
  log('已保存 Markdown: ' + outputMdPath, 2);

  const archiveSubDir = buildArchiveSubDir(skillRoot, info.baseNameNoExt);
  mkdirp(archiveSubDir);

  // Copy all files from workDir to archive
  const workItems = fs.readdirSync(workDir);
  for (const item of workItems) {
    const src = path.join(workDir, item);
    const dest = path.join(archiveSubDir, item);
    if (item === 'result.zip') continue;
    if (item.startsWith('input.')) continue;
    if (item.endsWith('_origin')) continue;
    try {
      const stat = fs.statSync(src);
      if (stat.isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        fs.cpSync(src, dest, { recursive: true });
      } else {
        fs.copyFileSync(src, dest);
      }
    } catch (e) {}
  }

  const archivedMdPath = path.join(archiveSubDir, 'full.md');
  const mdExists = fs.existsSync(archivedMdPath);
  let imageManifest = [];
  if (mdExists) {
    const archivedMdContent = readTextFile(archivedMdPath);
    imageManifest = downloadRemoteImages(archiveSubDir, archivedMdContent);
  }

  const archivedMdNewPath = path.join(archiveSubDir, info.baseNameNoExt + '.md');
  if (fs.existsSync(archivedMdPath) && archivedMdPath !== archivedMdNewPath) {
    fs.renameSync(archivedMdPath, archivedMdNewPath);
  }

  writeJsonFile(path.join(archiveSubDir, 'conversion_meta.json'), {
    mode: extraMeta.mode,
    source_file: extraMeta.sourceFile,
    output_markdown: outputMdPath,
    archive_path: archiveSubDir,
    detail: extraMeta.detail,
    images: imageManifest
  });

  log('已归档: ' + archiveSubDir, 2);

  return {
    success: true,
    outputPath: outputMdPath,
    archivePath: archiveSubDir,
    mode: extraMeta.mode,
    message: '成功转换 ' + info.fileName + ' -> ' + info.baseNameNoExt + '.md' +
      (extraMeta.mode === 'token' ? '（标准 Token API）' : '（免费接口）') +
      (extraMeta.mode === 'light' ? '（当前为免费接口，如需更大文件/更长文档请配置 Token）' : '')
  };
}

// ============ Token API conversion ============
async function convertLocalFileWithTokenApi(filePath, info, options, log) {
  const API_BASE = options.apiBase || 'https://mineru.net/api/v4';
  const API_TOKEN = options.apiToken;
  const workDir = mkTempDir('mineru_token');
  const inputFile = path.join(workDir, 'input.' + info.ext);

  try {
    copyFile(filePath, inputFile);

    const dataId = 'convert_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
    const fileItem = {
      name: info.fileName,
      is_ocr: !!options.enableOcr,
      data_id: dataId
    };
    if (options.pageRanges) {
      fileItem.page_ranges = options.pageRanges;
    }
    const req1 = {
      enable_formula: !!options.enableFormula,
      language: options.languageCode,
      enable_table: !!options.enableTable,
      model_version: options.modelVersion,
      files: [fileItem]
    };

    const rawBody = JSON.stringify(req1);

    const resp1 = await httpRequest(API_BASE + '/file-urls/batch', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + API_TOKEN,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(rawBody)
      },
      body: rawBody
    });

    if (resp1.status !== 200 && resp1.status !== 201) {
      if (resp1.status === 401 || resp1.status === 403 || resp1.body.indexOf('Unauthorized') > -1) {
        throw new Error(buildExpiredTokenHelp('', resp1.status));
      }
      throw new Error('文件上传地址获取失败 (HTTP ' + resp1.status + '): ' + resp1.body);
    }

    let uploadTicket;
    try {
      uploadTicket = JSON.parse(resp1.body);
    } catch (e) {
      throw new Error('解析上传响应失败: ' + resp1.body);
    }

    const batchId = uploadTicket.batch_id || (uploadTicket.data && uploadTicket.data.batch_id) || '';
    const fileUrls = uploadTicket.file_urls || (uploadTicket.data && uploadTicket.data.file_urls) || [];
    const ossHeaders = uploadTicket.headers || (uploadTicket.data && uploadTicket.data.headers) || [];
    let uploadURLRaw = Array.isArray(fileUrls) && fileUrls.length > 0 ? fileUrls[0] : '';

    if (!batchId || !uploadURLRaw) {
      throw new Error('API 响应缺少 batch_id 或 file_urls: ' + resp1.body);
    }

    let uploadURL = uploadURLRaw;
    try { uploadURL = JSON.parse(uploadURLRaw); } catch (e) { uploadURL = uploadURLRaw; }
    uploadURL = String(uploadURL).replace(/[\n\r\t]+/g, ' ');

    log('开始上传文件到标准 Token API...', 2);

    const fileContent = fs.readFileSync(inputFile);

    const uploadResp = await httpRequest(uploadURL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': fileContent.length
      },
      body: fileContent
    });

    if (uploadResp.status !== 200 && uploadResp.status !== 201) {
      throw new Error('文件上传失败 (HTTP ' + uploadResp.status + ')');
    }

    log('文件已上传，开始查询结果...', 2);

    const pollURL = API_BASE + '/extract-results/batch/' + batchId;
    let pollCount = 0;
    let resultUrl = '';

    while (pollCount < options.pollMax && !resultUrl) {
      await new Promise(r => setTimeout(r, options.pollSleep * 1000));
      pollCount++;

      const pollResp = await httpRequest(pollURL, {
        headers: { 'Authorization': 'Bearer ' + API_TOKEN }
      });

      if (pollResp.status === 401 || pollResp.status === 403) {
        throw new Error(buildExpiredTokenHelp('', pollResp.status));
      }

      let pollResponse;
      try {
        pollResponse = JSON.parse(pollResp.body);
      } catch (e) {
        if (pollCount >= options.pollMax) break;
        continue;
      }

      const resultList = (pollResponse.data && pollResponse.data.extract_result) || [];
      if (Array.isArray(resultList) && resultList.length > 0) {
        for (const item of resultList) {
          if (item && item.state === 'done' && item.full_zip_url) {
            resultUrl = item.full_zip_url;
            break;
          }
          if (item && item.state === 'failed') {
            throw new Error('MinerU 服务失败: ' + (item.err_msg || '未知错误'));
          }
        }
        if (resultUrl) break;
        if (pollCount % 10 === 0) {
          log('标准 Token API 转换中... (' + pollCount + '/' + options.pollMax + ')', 2);
        }
      }
    }

    if (!resultUrl) {
      throw new Error('转换超时，已尝试 ' + pollCount + ' 次');
    }

    const resultFile = path.join(workDir, 'result.zip');
    await downloadFile(resultUrl, resultFile);

    // Unzip
    const extractDir = path.join(workDir, 'extracted');
    mkdirp(extractDir);
    try {
      execSync(`powershell -Command "Expand-Archive -Path '${resultFile}' -DestinationPath '${extractDir}' -Force"`, { encoding: 'utf8', shell: true });
    } catch (e) {
      // Fallback: copy zip and let user handle
      throw new Error('解压失败，请确认 PowerShell 可用');
    }

    let discoveredMdFile = findFiles(extractDir, /\.md$/)[0] || '';
    if (!discoveredMdFile) {
      throw new Error('未找到 Markdown 文件');
    }

    const mdFile = path.join(workDir, 'full.md');
    if (discoveredMdFile !== mdFile) {
      fs.copyFileSync(discoveredMdFile, mdFile);
    }

    return finalizeResult(workDir, '', info, mdFile, {
      mode: 'token',
      sourceFile: filePath,
      detail: { api_base: API_BASE, batch_id: batchId, result_zip_url: resultUrl }
    }, log);
  } finally {
    rmrf(workDir);
  }
}

async function convertRemoteUrlWithTokenApi(sourceUrl, info, options, log) {
  const API_BASE = options.apiBase || 'https://mineru.net/api/v4';
  const API_TOKEN = options.apiToken;
  const workDir = mkTempDir('mineru_url_token');

  try {
    const requestBody = {
      url: sourceUrl,
      language: options.languageCode,
      is_ocr: !!options.enableOcr,
      enable_table: !!options.enableTable,
      enable_formula: !!options.enableFormula,
      model_version: options.modelVersion
    };

    log('提交远程 URL 到标准 Token API...', 2);

    const createResp = await httpRequest(API_BASE + '/extract/task', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + API_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (createResp.status === 401 || createResp.status === 403) {
      throw new Error(buildExpiredTokenHelp('', createResp.status));
    }
    if (createResp.status !== 200 && createResp.status !== 201) {
      throw new Error('提交远程 URL 任务失败 (HTTP ' + createResp.status + '): ' + createResp.body);
    }

    let createData;
    try {
      createData = JSON.parse(createResp.body);
    } catch (e) {
      throw new Error('解析任务响应失败: ' + createResp.body);
    }

    if (createData.code !== 0 || !createData.data || !createData.data.task_id) {
      throw new Error('提交远程 URL 任务失败: ' + (createData.msg || createResp.body));
    }

    log('URL 模式任务已提交，开始查询...', 2);
    let pollCount = 0;
    let resultUrl = '';

    while (pollCount < options.pollMax && !resultUrl) {
      await new Promise(r => setTimeout(r, options.pollSleep * 1000));
      pollCount++;

      const pollResp = await httpRequest(API_BASE + '/extract/task/' + createData.data.task_id, {
        headers: { 'Authorization': 'Bearer ' + API_TOKEN }
      });

      if (pollResp.status === 401 || pollResp.status === 403) {
        throw new Error(buildExpiredTokenHelp('', pollResp.status));
      }

      let pollData;
      try {
        pollData = JSON.parse(pollResp.body);
      } catch (e) {
        if (pollCount >= options.pollMax) break;
        continue;
      }

      const data = pollData.data || {};
      if (data.state === 'done' && data.full_zip_url) {
        resultUrl = data.full_zip_url;
        break;
      }
      if (data.state === 'failed') {
        throw new Error('MinerU 服务失败: ' + (data.err_msg || '未知错误'));
      }
      if (pollCount % 10 === 0) {
        log('标准 Token API URL 模式转换中... (' + pollCount + '/' + options.pollMax + ')', 2);
      }
    }

    if (!resultUrl) {
      throw new Error('转换超时，已尝试 ' + pollCount + ' 次');
    }

    const resultFile = path.join(workDir, 'result.zip');
    await downloadFile(resultUrl, resultFile);

    const extractDir = path.join(workDir, 'extracted');
    mkdirp(extractDir);
    try {
      execSync(`powershell -Command "Expand-Archive -Path '${resultFile}' -DestinationPath '${extractDir}' -Force"`, { encoding: 'utf8', shell: true });
    } catch (e) {
      throw new Error('解压失败');
    }

    let discoveredMdFile = findFiles(extractDir, /\.md$/)[0] || '';
    if (!discoveredMdFile) {
      throw new Error('未找到 Markdown 文件');
    }

    const mdFile = path.join(workDir, 'full.md');
    fs.copyFileSync(discoveredMdFile, mdFile);

    return finalizeResult(workDir, '', info, mdFile, {
      mode: 'token',
      sourceFile: sourceUrl,
      detail: { api_base: API_BASE, task_id: createData.data.task_id, result_zip_url: resultUrl, source_type: info.sourceType }
    }, log);
  } finally {
    rmrf(workDir);
  }
}

// ============ Light API conversion (免费接口) ============
async function convertLocalFileWithLightApi(filePath, info, options, log) {
  const LIGHT_API_BASE = 'https://mineru.net/api/v1/agent';
  const workDir = mkTempDir('mineru_light');
  const inputFile = path.join(workDir, 'input.' + info.ext);

  try {
    copyFile(filePath, inputFile);

    const submitReq = {
      file_name: info.fileName,
      language: options.languageCode,
      is_ocr: !!options.enableOcr
    };

    log('提交文件到免费接口...', 2);

    const submitResp = await httpRequest(LIGHT_API_BASE + '/parse/file', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(submitReq))
      },
      body: JSON.stringify(submitReq)
    });

    if (submitResp.status !== 200 && submitResp.status !== 201) {
      throw new Error('免费接口提交失败 (HTTP ' + submitResp.status + '): ' + submitResp.body);
    }

    let submitData;
    try {
      submitData = JSON.parse(submitResp.body);
    } catch (e) {
      throw new Error('解析提交响应失败: ' + submitResp.body);
    }

    if (submitData.code !== 0 || !submitData.data) {
      throw new Error('免费接口提交失败: ' + (submitData.msg || submitData.message || submitResp.body));
    }

    const taskId = submitData.data.task_id || '';
    const uploadUrl = submitData.data.file_url || '';
    if (!taskId || !uploadUrl) {
      throw new Error('免费接口响应缺少 task_id 或 file_url: ' + submitResp.body);
    }

    log('上传文件到免费接口...', 2);

    const uploadResp = await httpRequest(uploadUrl, {
      method: 'PUT',
      body: fs.readFileSync(inputFile)
    });

    if (uploadResp.status !== 200 && uploadResp.status !== 201) {
      throw new Error('免费接口文件上传失败 (HTTP ' + uploadResp.status + ')');
    }

    log('免费接口处理中，开始查询...', 2);

    let pollCount = 0;
    let markdownUrl = '';

    while (pollCount < options.pollMax && !markdownUrl) {
      await new Promise(r => setTimeout(r, options.pollSleep * 1000));
      pollCount++;

      const pollResp = await httpRequest(LIGHT_API_BASE + '/parse/' + taskId, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      if (pollResp.status !== 200 && pollResp.status !== 201) {
        throw new Error('免费接口查询失败 (HTTP ' + pollResp.status + '): ' + pollResp.body);
      }

      let pollRespData;
      try {
        pollRespData = JSON.parse(pollResp.body);
      } catch (e) {
        if (pollCount >= options.pollMax) break;
        continue;
      }

      if (pollRespData.code !== 0 || !pollRespData.data) {
        throw new Error('免费接口查询失败: ' + (pollRespData.msg || pollRespData.message || pollResp.body));
      }

      const state = pollRespData.data.state || '';
      if (state === 'done' && pollRespData.data.markdown_url) {
        markdownUrl = pollRespData.data.markdown_url;
        break;
      }
      if (state === 'failed') {
        throw new Error('免费接口处理失败: ' + (pollRespData.data.err_msg || pollRespData.data.msg || '未知错误'));
      }
      if (pollCount % 10 === 0) {
        log('免费接口处理进度... (' + pollCount + '/' + options.pollMax + ')', 2);
      }
    }

    if (!markdownUrl) {
      throw new Error('免费接口超时，已尝试 ' + pollCount + ' 次');
    }

    const mdFile = path.join(workDir, 'full.md');
    const mdResp = await httpRequest(markdownUrl, {});
    if (mdResp.status !== 200 && mdResp.status !== 201) {
      throw new Error('下载 Markdown 失败 (HTTP ' + mdResp.status + ')');
    }
    writeTextFile(mdFile, mdResp.body);

    return finalizeResult(workDir, '', info, mdFile, {
      mode: 'light',
      sourceFile: filePath,
      detail: { task_id: taskId, markdown_url: markdownUrl }
    }, log);
  } finally {
    rmrf(workDir);
  }
}

async function convertRemoteUrlWithLightApi(sourceUrl, info, options, log) {
  const LIGHT_API_BASE = 'https://mineru.net/api/v1/agent';
  const workDir = mkTempDir('mineru_light_url');

  try {
    const submitReq = {
      url: sourceUrl,
      file_name: info.fileName,
      language: options.languageCode,
      is_ocr: !!options.enableOcr
    };

    log('提交远程 URL 到免费接口...', 2);

    const submitResp = await httpRequest(LIGHT_API_BASE + '/parse/url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submitReq)
    });

    if (submitResp.status !== 200 && submitResp.status !== 201) {
      throw new Error('免费接口 URL 提交失败 (HTTP ' + submitResp.status + '): ' + submitResp.body);
    }

    let submitData;
    try {
      submitData = JSON.parse(submitResp.body);
    } catch (e) {
      throw new Error('解析 URL 提交响应失败: ' + submitResp.body);
    }

    if (submitData.code !== 0 || !submitData.data || !submitData.data.task_id) {
      throw new Error('免费接口 URL 提交失败: ' + (submitData.msg || submitData.message || submitResp.body));
    }

    log('免费接口 URL 任务已提交，开始查询...', 2);
    let pollCount = 0;
    let markdownUrl = '';

    while (pollCount < options.pollMax && !markdownUrl) {
      await new Promise(r => setTimeout(r, options.pollSleep * 1000));
      pollCount++;

      const pollResp = await httpRequest(LIGHT_API_BASE + '/parse/' + submitData.data.task_id, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      if (pollResp.status !== 200 && pollResp.status !== 201) {
        throw new Error('免费接口 URL 查询失败 (HTTP ' + pollResp.status + '): ' + pollResp.body);
      }

      let pollRespData;
      try {
        pollRespData = JSON.parse(pollResp.body);
      } catch (e) {
        if (pollCount >= options.pollMax) break;
        continue;
      }

      if (pollRespData.code !== 0 || !pollRespData.data) {
        throw new Error('免费接口 URL 查询失败: ' + (pollRespData.msg || pollRespData.message || pollResp.body));
      }
      if (pollRespData.data.state === 'done' && pollRespData.data.markdown_url) {
        markdownUrl = pollRespData.data.markdown_url;
        break;
      }
      if (pollRespData.data.state === 'failed') {
        throw new Error('免费接口 URL 处理失败: ' + (pollRespData.data.err_msg || '未知错误'));
      }
      if (pollCount % 10 === 0) {
        log('免费接口 URL 处理进度... (' + pollCount + '/' + options.pollMax + ')', 2);
      }
    }

    if (!markdownUrl) {
      throw new Error('免费接口 URL 超时，已尝试 ' + pollCount + ' 次');
    }

    const mdFile = path.join(workDir, 'full.md');
    const mdResp = await httpRequest(markdownUrl, {});
    if (mdResp.status !== 200 && mdResp.status !== 201) {
      throw new Error('下载 Markdown 失败 (HTTP ' + mdResp.status + ')');
    }
    writeTextFile(mdFile, mdResp.body);

    return finalizeResult(workDir, '', info, mdFile, {
      mode: 'light',
      sourceFile: sourceUrl,
      detail: { task_id: submitData.data.task_id, markdown_url: markdownUrl, source_type: info.sourceType }
    }, log);
  } finally {
    rmrf(workDir);
  }
}

// ============ Token verify ============
async function verifyToken(sh, skillRoot, config) {
  const apiToken = resolveApiToken(config);
  if (!apiToken) {
    return '当前未配置 MinerU Token，将使用免费接口。';
  }

  const apiBase = sanitizeConfigValue(config.MINERU_API_BASE) || 'https://mineru.net/api/v4';
  const probeTaskId = '00000000-0000-0000-0000-000000000000';
  const probeRespPath = path.join(getTmpDir(), 'mineru-token-verify-' + Date.now() + '.json');

  try {
    const probeResp = await httpRequest(apiBase + '/extract/task/' + probeTaskId, {
      headers: { 'Authorization': 'Bearer ' + apiToken }
    });

    if (probeResp.status === 401 || probeResp.status === 403) {
      throw new Error(buildExpiredTokenHelp(skillRoot, probeResp.status));
    }
    if (probeResp.status !== 200 && probeResp.status !== 404) {
      return 'Token 验证异常，接口返回 HTTP ' + probeResp.status + '，将降级为免费接口。';
    }
    return 'Token 验证通过，已成功连接 ' + apiBase + '，当前使用标准 Token API。';
  } catch (e) {
    if (e.message.includes('401') || e.message.includes('403')) {
      throw e;
    }
    return 'Token 已配置但无法连接到 ' + apiBase + '，将降级为免费接口。（错误: ' + e.message + '）';
  }
}

// ============ Main convert ============
async function convert(source) {
  const skillRoot = resolveSkillRoot();
  const config = loadConfig(skillRoot);
  const apiToken = resolveApiToken(config);
  const mode = apiToken ? 'token' : 'light';
  const info = buildSourceInfo(source, mode, skillRoot);

  const options = {
    apiBase: config.MINERU_API_BASE || 'https://mineru.net/api/v4',
    apiToken,
    enableOcr: parseBoolean(config.MINERU_ENABLE_OCR, true),
    enableTable: parseBoolean(config.MINERU_ENABLE_TABLE, true),
    enableFormula: parseBoolean(config.MINERU_ENABLE_FORMULA, false),
    languageCode: config.MINERU_LANGUAGE_CODE || 'ch',
    modelVersion: resolveTokenModelVersion(config.MINERU_MODEL_VERSION, info.sourceType),
    pageRanges: normalizePageRanges(config.MINERU_PAGE_RANGES),
    pollMax: parseInteger(config.MINERU_POLL_MAX, 20),
    pollSleep: parseInteger(config.MINERU_POLL_SLEEP, 10),
    logLevel: config.MINERU_LOG_LEVEL || 'medium'
  };

  const levelMap = { low: 1, medium: 2, high: 3 };
  const currentLevel = levelMap[options.logLevel] || 2;
  const log = (message, level) => {
    if ((level || 1) <= currentLevel) {
      console.log(message);
    }
  };

  log('开始转换: ' + info.fileName, 2);
  log('转换模式: ' + (mode === 'token' ? '标准 Token API' : '免费接口'), 2);
  log('来源类型: ' + info.sourceType, 2);

  if (mode === 'token') {
    if (info.sourceType === 'local_file') {
      // On Windows, try native CLI first for Token API (it handles OSS upload correctly)
      if (process.platform === 'win32' && findNativeCli()) {
        try {
          return await convertWithNativeCli(source, info, skillRoot, log);
        } catch (e) {
          log('Native CLI failed, falling back to direct API: ' + e.message, 2);
          // Fall through to direct API
        }
      }
      return await convertLocalFileWithTokenApi(source, info, options, log);
    }
    return await convertRemoteUrlWithTokenApi(source, info, options, log);
  }
  if (info.sourceType === 'local_file') {
    return await convertLocalFileWithLightApi(source, info, options, log);
  }
  return await convertRemoteUrlWithLightApi(source, info, options, log);
}

// ============ CLI entry ============
function run(argv) {
  try {
    if (!argv || argv.length === 0) {
      return '用法: node convert.js <文件路径或URL>\n      node convert.js --verify-token\n缺少文件路径或 URL 参数';
    }

    const command = argv[0];
    if (command === '--verify-token' || command === 'verify-token' || command === 'checktoken') {
      const skillRoot = resolveSkillRoot();
      const config = loadConfig(skillRoot);
      return verifyToken(null, skillRoot, config).then(r => r).catch(e => e.message);
    }

    const result = convert(command);
    if (result && typeof result.then === 'function') {
      return result.then(r => r.message).catch(e => '转换失败: ' + e.message);
    }
    return result.message;
  } catch (error) {
    return '转换失败: ' + error.message;
  }
}

// Make module importable
if (require.main === module) {
  const result = run(process.argv.slice(2));
  if (result && typeof result.then === 'function') {
    result.then(msg => {
      console.log(msg);
      process.exit(0);
    }).catch(err => {
      console.error('错误:', err.message);
      process.exit(1);
    });
  } else {
    console.log(result);
    process.exit(0);
  }
}

module.exports = { convert, verifyToken };
