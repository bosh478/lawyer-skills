# JPG Export 模式规范

本文档是 JPG Export 模式的规范，当用户明确要求将配图转换为 JPG/PNG 图片文件时使用。

## 模式特性

- 将配图保存为独立的 JPG 文件
- 使用 Node.js + sharp 库进行 SVG 转 JPG 转换
- 文件保存到源文章目录的 `配图/` 子目录
- 在 Markdown 中插入图片引用

---

## 依赖

### Node.js 包

| 包名 | 用途 | 安装命令 |
|------|------|----------|
| `sharp` | SVG 转 PNG/JPG 高保真渲染 | `npm install sharp` |

---

## 一、工作流程

### Step 1: 提取 SVG

从 Markdown 中提取所有 `<svg>...</svg>` 代码块，保存为临时 SVG 文件。

### Step 2: 转换 JPG

使用 sharp 库将 SVG 转换为 JPG：
1. 读取 SVG 文件
2. 转换为 PNG（1600x900，分辨率 600 DPI 等效）
3. 转换为 JPG（质量 95%）
4. 处理透明背景（添加白色背景）

### Step 3: 清理临时文件

转换完成后删除中间文件：
- 删除 SVG 文件
- 删除 PNG 文件
- 保留 JPG 文件

### Step 4: 更新 Markdown

将 `[[ILLUSTRATION:XX:描述]]` + `<svg>...</svg>` 替换为 `![描述](配图/XX.jpg)` 格式。

---

## 二、文件保存位置

### 强制规则

- **所有 JPG 文件必须保存到源文章所在目录的 `配图/` 子目录**
- 目录结构：`{文章目录}/配图/XX.jpg`
- 如果 `配图/` 目录不存在，自动创建

### 目录结构示例

```text
articles/
├── 文章标题.md          # 源文章
└── 配图/
    ├── 01.jpg           # 配图 1
    ├── 02.jpg           # 配图 2
    └── ...
```

---

## 三、文件命名规范

### 命名格式

- **格式**：`序号.jpg`（2 位数字）
- **序号**：从 01 开始，与配图编号对应
- **扩展名**：.jpg

### 命名示例

| 文件名 | 说明 |
|--------|------|
| `01.jpg` | 配图 1 |
| `02.jpg` | 配图 2 |
| `21.jpg` | 配图 21 |

---

## 四、SVG 转 JPG 转换脚本

### 转换脚本（Node.js + sharp）

```javascript
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const svgDir = 'D:/文章目录/配图';  // SVG 文件目录
const outputDir = 'D:/文章目录/配图';  // JPG 输出目录

function fixSvg(svgContent) {
  // 确保属性使用双引号
  let fixed = svgContent.replace(/'/g, '"');
  // 移除可能导致 XML 解析错误的动画标签
  fixed = fixed.replace(/<animate[^>]*>\s*<\/animate>/gi, '');
  fixed = fixed.replace(/<animate[^>]*\/>/gi, '');
  // 修复末尾多余的 </g> 标签
  fixed = fixed.replace(/<\/g>\s*<\/svg>$/, '</svg>');
  return fixed;
}

async function convertSvgToJpg(svgPath, num) {
  const pngPath = path.join(outputDir, `${num}.png`);
  const jpgPath = path.join(outputDir, `${num}.jpg`);

  try {
    let svgContent = fs.readFileSync(svgPath, 'utf8');
    svgContent = fixSvg(svgContent);

    const svgBuffer = Buffer.from(svgContent, 'utf8');

    // SVG → PNG（白底）
    await sharp(svgBuffer)
      .resize(1600, 900, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
      .png()
      .toFile(pngPath);

    // PNG → JPG（质量 95%）
    await sharp(pngPath)
      .jpeg({ quality: 95 })
      .toFile(jpgPath);

    // 清理临时文件
    fs.unlinkSync(svgPath);
    fs.unlinkSync(pngPath);
    console.log(`OK: ${num}.jpg`);
  } catch (err) {
    console.log(`Error ${num}: ${err.message}`);
  }
}

async function convertAll() {
  const svgFiles = fs.readdirSync(svgDir)
    .filter(f => f.endsWith('.svg'))
    .sort();

  for (const file of svgFiles) {
    const num = file.replace('.svg', '');
    const svgPath = path.join(svgDir, file);
    await convertSvgToJpg(svgPath, num);
  }

  console.log('\nAll conversions done!');
}

convertAll();
```

### 关键处理

1. **SVG 修复**：
   - 将单引号替换为双引号（XML 解析要求）
   - 移除可能导致解析错误的动画标签
   - 修复末尾多余的 `</g>` 标签

2. **白底处理**：
   - PNG 转换时设置白色背景 `{ r: 255, g: 255, b: 255 }`
   - 处理 RGBA/LA/P 模式的透明通道

3. **尺寸**：
   - 输出尺寸 1600x900（16:9 比例，800x450 的 2 倍）
   - 足够清晰以满足打印/发布需求

---

## 五、Markdown 更新脚本

### 更新脚本

```javascript
const fs = require('fs');
const path = require('path');

const mdPath = 'D:/文章目录/文章.md';
const imgDir = 'D:/文章目录/配图';

let content = fs.readFileSync(mdPath, 'utf8');

// 匹配 [[ILLUSTRATION:XX:描述]] + <svg>...</svg>
const regex = /\[\[ILLUSTRATION:(\d{2}):([^\]]+)\]\]\s*<svg[^>]*>[\s\S]*?<\/svg>/gi;

let match;
let count = 0;

while ((match = regex.exec(content)) !== null) {
  const num = match[1].padStart(2, '0');
  const desc = match[2];
  const jpgPath = `配图/${num}.jpg`;

  const replacement = `![${desc}](${jpgPath})`;
  content = content.replace(match[0], replacement);
  count++;
}

fs.writeFileSync(mdPath, content, 'utf8');
console.log(`Updated ${count} illustrations to JPG references`);
```

---

## 六、常见问题处理

### SVG XML 解析错误

**问题**：`Opening and ending tag mismatch: svg line 1 and g`

**原因**：SVG 中有未匹配的标签（如多余的 `</g>`）

**解决方案**：
```javascript
function fixSvg(svgContent) {
  // 计算 g 标签的开闭数量，修复多余的闭合标签
  const openCount = (svgContent.match(/<g>/gi) || []).length;
  const closeCount = (svgContent.match(/<\/g>/gi) || []).length;

  if (closeCount > openCount) {
    svgContent = svgContent.replace(/<\/g>\s*<\/svg>$/, '</svg>');
  }

  return svgContent;
}
```

### 属性引号问题

**问题**：单引号属性导致 XML 解析失败

**解决方案**：
```javascript
svgContent = svgContent.replace(/'/g, '"');
```

### animate 标签导致错误

**问题**：`<animate>...</animate>` 标签在某些 SVG 解析器中导致错误

**解决方案**：
```javascript
fixed = fixed.replace(/<animate[^>]*>[\s\S]*?<\/animate>/gi, '');
fixed = fixed.replace(/<animate[^>]*\/>/gi, '');
```

---

## 七、常见问题处理

### SVG XML 解析错误

**问题**：`Opening and ending tag mismatch: svg line 1 and g`

**原因**：SVG 中有未匹配的标签（如多余的 `</g>`）

**解决方案**：
```javascript
function fixSvg(svgContent) {
  // 计算 g 标签的开闭数量，修复多余的闭合标签
  const openCount = (svgContent.match(/<g>/gi) || []).length;
  const closeCount = (svgContent.match(/<\/g>/gi) || []).length;

  if (closeCount > openCount) {
    svgContent = svgContent.replace(/<\/g>\s*<\/svg>$/, '</svg>');
  }

  return svgContent;
}
```

### 属性引号问题

**问题**：单引号属性导致 XML 解析失败

**解决方案**：
```javascript
svgContent = svgContent.replace(/'/g, '"');
```

### animate 标签导致错误

**问题**：`<animate>...</animate>` 标签在某些 SVG 解析器中导致错误

**解决方案**：
```javascript
fixed = fixed.replace(/<animate[^>]*>[\s\S]*?<\/animate>/gi, '');
fixed = fixed.replace(/<animate[^>]*\/>/gi, '');
```

---

## 八、质量保障流程

**【强制要求 - 源自配图11经验教训】**

### 8.1 生成后验证

生成 JPG 后，必须检查：

1. **文件大小**：正常应在 80KB-200KB 之间，过小说明可能截断，过大可能是色彩异常
2. **尺寸**：应为 1600x900 像素
3. **内容完整性**：检查是否有元素被截断或消失

### 8.2 布局问题处理

当用户反馈"排版有问题"时：

| 步骤 | 操作 |
|------|------|
| 1 | **主动询问具体问题**：布局拥挤/文字重叠/色彩不均等？ |
| 2 | **检查边界**：元素是否超出安全边距（60px） |
| 3 | **对比参照**：查看同批次其他正常图片的布局 |
| 4 | **小步迭代**：每次只改一个方面，避免多处同时修改 |

### 8.3 复杂图示处理

对于包含多个阶段的流程图，采用两阶段生成法：

**阶段1**：先生成简化框架（标题+主要区块+箭头）
**阶段2**：框架验证后，逐步添加细节

---

## 九、成功标准

- 配图以 JPG 格式保存在 `配图/` 子目录
- 文件命名规范：`01.jpg`, `02.jpg`, ... `21.jpg`
- Markdown 中的引用格式正确：`![描述](配图/XX.jpg)`
- JPG 图片清晰度满足发布需求（1600x900, 95%质量）
- 内容完整，无截断、无重叠