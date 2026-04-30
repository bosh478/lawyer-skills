/**
 * svg2jpg.js - SVG to JPG 高保真转换脚本
 *
 * 使用 sharp 库将 SVG 转换为 JPG 图片
 *
 * 用法：
 *   node svg2jpg.js input.svg [output.jpg] [dpi]
 *
 * 示例：
 *   node svg2jpg.js input.svg output.jpg
 *   node svg2jpg.js input.svg 600
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// 参数解析
const args = process.argv.slice(2);
if (args.length < 1) {
  console.log('用法: node svg2jpg.js input.svg [output.jpg] [dpi]');
  process.exit(1);
}

const inputPath = args[0];
const outputPath = args[1] || null;  // 如果未指定，则自动生成
const dpi = args[2] ? parseInt(args[2], 10) : 600;

// 检查输入文件是否存在
if (!fs.existsSync(inputPath)) {
  console.error(`错误: 输入文件不存在: ${inputPath}`);
  process.exit(1);
}

/**
 * 修复 SVG 内容以确保 XML 兼容性
 */
function fixSvg(svgContent) {
  // 确保属性使用双引号
  let fixed = svgContent.replace(/'/g, '"');

  // 移除可能导致 XML 解析错误的动画标签
  fixed = fixed.replace(/<animate[^>]*>\s*<\/animate>/gi, '');
  fixed = fixed.replace(/<animateTransform[^>]*>\s*<\/animateTransform>/gi, '');
  fixed = fixed.replace(/<animate[^>]*\/>/gi, '');
  fixed = fixed.replace(/<animateTransform[^>]*\/>/gi, '');

  // 修复末尾多余的 </g> 标签
  fixed = fixed.replace(/<\/g>\s*<\/svg>$/, '</svg>');

  // 确保 viewBox 存在
  if (!fixed.includes('viewBox')) {
    fixed = fixed.replace(/<svg([^>]*)>/, '<svg$1 viewBox="0 0 800 450">');
  }

  return fixed;
}

/**
 * 确保目录存在
 */
function ensureDirSync(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 获取输出路径
 * 如果未指定 outputPath，则在输入文件所在目录创建配图/子目录
 */
function getOutputPath(inputPath) {
  if (outputPath) {
    return outputPath;
  }

  const dir = path.dirname(inputPath);
  const name = path.basename(inputPath, path.extname(inputPath));
  return path.join(dir, `${name}.jpg`);
}

/**
 * 获取配图目录路径
 * 在输入文件所在目录创建配图/子目录
 */
function getPeizhiDir(inputPath) {
  const dir = path.dirname(inputPath);
  return path.join(dir, '配图');
}

/**
 * 转换 SVG 到 JPG
 */
async function convertSvgToJpg(svgPath, jpgPath) {
  try {
    console.log(`读取 SVG: ${svgPath}`);

    let svgContent = fs.readFileSync(svgPath, 'utf8');
    svgContent = fixSvg(svgContent);

    const svgBuffer = Buffer.from(svgContent, 'utf8');

    // 计算输出尺寸（基于 DPI）
    // 800x450 是画布尺寸，按 DPI 比例放大
    const scale = dpi / 96;  // 96 DPI 是屏幕默认
    const width = Math.round(800 * scale);
    const height = Math.round(450 * scale);

    console.log(`转换尺寸: ${width}x${height} (DPI: ${dpi})`);

    // SVG → PNG（白底）
    const pngBuffer = await sharp(svgBuffer)
      .resize(width, height, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
      .png()
      .toBuffer();

    // PNG → JPG（质量 95%）
    await sharp(pngBuffer)
      .jpeg({ quality: 95 })
      .toFile(jpgPath);

    // 验证输出文件
    const stats = fs.statSync(jpgPath);
    console.log(`✓ 生成 JPG: ${jpgPath} (${(stats.size / 1024).toFixed(1)} KB)`);

    // 检查文件大小是否正常（应在 80KB-200KB 之间）
    if (stats.size < 50000) {
      console.warn(`警告: 文件过小 (${stats.size} bytes)，可能转换有问题`);
    } else if (stats.size > 500000) {
      console.warn(`警告: 文件过大 (${(stats.size / 1024).toFixed(1)} KB)，请检查内容`);
    }

  } catch (err) {
    console.error(`转换失败: ${err.message}`);
    throw err;
  }
}

/**
 * 主函数
 */
async function main() {
  const inputAbsolute = path.resolve(inputPath);
  const outputAbsolute = path.resolve(getOutputPath(inputAbsolute));

  // 确保输出目录存在
  const outputDir = path.dirname(outputAbsolute);
  ensureDirSync(outputDir);

  await convertSvgToJpg(inputAbsolute, outputAbsolute);

  console.log('\n转换完成!');
}

// 执行
main().catch(err => {
  console.error('错误:', err);
  process.exit(1);
});
