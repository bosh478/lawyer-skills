---
name: tkk-image
homepage: https://github.com/tkkkkk
author: 汤康康
version: "1.0.0"
license: MIT
description: AI驱动的文章配图生成工具，默认输出JPG图片，支持动态/静态SVG导出。当用户需要为文章生成配图、创建插图时使用此技能。
---

# tkk-image - 文章配图生成工具

> ⚠️ **修改前必读**：本 Skill 采用 Git 版本管理，修改前**必须**执行备份，否则无法回滚。

AI 驱动的文章配图生成工具，使用 SVG 技术为文章生成高质量配图，默认输出 JPG 图片文件。

> **重要说明**：默认模式（jpg-export）将 **JPG 图片文件**通过 Markdown 图片引用 `![](配图/XX.jpg)` 插入文章。如需嵌入 SVG 动画效果，请明确指定 dynamic-svg 模式。

## 快速开始

```
/tkk-image @path/to/article.md
```

## 版本控制与备份

本 Skill 采用 Git 版本管理。每次修改前**必须**创建备份快照，以便回滚至旧版本。

### 备份操作流程

**修改前必做**（硬性要求）：

```bash
# 1. 进入 skill 目录
cd ~/.claude/skills/tkk-image

# 2. 创建带时间戳的备份分支
git checkout -b backup/$(date +%Y%m%d_%H%M%S)

# 3. 提交当前状态作为快照
git add -A
git commit -m "backup: pre-modification snapshot"
```

### 回滚操作

如需回滚至旧版本：

```bash
# 1. 查看所有备份分支
git branch -a | grep backup

# 2. 切换至目标备份分支
git checkout backup/YYYYMMDD_HHMMSS

# 3. 可选：创建回滚分支进行验证
git checkout -b restore/YYYYMMDD_HHMMSS
```

### 备份检查清单

修改前确认以下操作已完成：

- [ ] `git status` 显示 clean 工作区
- [ ] 已创建带时间戳的备份分支
- [ ] 备份分支已提交快照
- [ ] 确认当前分支为备份分支（可用于测试）

---

## 依赖说明

- **jpg-export 模式**：需要 Node.js 和 sharp 包 (`npm install sharp`)
- **dynamic-svg / static-svg 模式**：无需安装任何依赖
- **png-export 模式**：需要安装 Node.js 和 puppeteer

---

## 核心概念：Type × Style × Palette

| 维度 | 说明 | 选项 |
|------|------|------|
| **Type** | 信息结构类型 | infographic, flowchart, comparison |
| **Style** | 视觉渲染风格 | minimal, warm, blueprint |
| **Palette** | 配色方案（可选） | default, macaron, warm, neon |

---

## 选择输出模式

根据用户需求和发布平台选择合适的输出模式：

| 用户场景           | 使用模式              | 加载参考文件              |
| ------------------ | --------------------- | ------------------------- |
| 默认/未指定        | **jpg-export** | references/jpg-export.md |
| 需要静态图片文件   | **jpg-export** | references/jpg-export.md  |
| 需要动画效果       | **dynamic-svg** | references/dynamic-svg.md |
| 不知道如何使用 SVG | **jpg-export** | references/jpg-export.md  |
| 明确要求静态效果   | **static-svg**  | references/static-svg.md  |
| 需要静态 SVG 代码  | **static-svg**  | references/static-svg.md  |
| 需要 PNG 兼容性    | **png-export**  | references/png-export.md  |

**默认模式**：当用户未明确指定时，使用 **jpg-export** 模式（生成 JPG 图片文件）。

---

## Type（类型）系统

| Type | 中文名 | 最佳适用场景 |
|------|--------|-------------|
| `infographic` | 信息图 | 数据、指标、技术说明 |
| `flowchart` | 流程图 | 流程、工作流、步骤 |
| `comparison` | 对比图 | 并列、对比、选项 |

---

## Style（风格）预设

| Style | 视觉特征 | 适用场景 |
|-------|---------|---------|
| `minimal` | 扁平静谧，大色块 | 专业、商务、正式 |
| `warm` | 暖色调，友好感 | 生活、情感、随笔 |
| `blueprint` | 深色背景，技术制图 | 技术架构、流程图 |

---

## Palette（配色）系统

| Palette | 背景色 | 区域色 | 强调色 | 风格感 |
|---------|--------|--------|--------|--------|
| `default` | 根据 Style 而定 | 根据 Style 而定 | 根据 Style 而定 | 标准 |
| `macaron` | 暖奶油 #F5F0E8 | 蓝 #A8D8EA, 薰衣草 #D5C6E0, 薄荷 #B5E5CF, 桃 #F8D5C4 | 珊瑚 #E8655A | 柔和、教育感 |
| `warm` | 柔桃 #FFECD2 | 橙 #ED8936, 赭 #C05621, 金 #F6AD55, 玫瑰 #D4A09A | 赭棕 #A0522D | 大地、温馨 |
| `neon` | 深紫 #1A1025 | 青 #00F5FF, 品红 #FF00FF, 绿 #39FF14, 粉 #FF6EC7 | 黄 #FFFF00 | 高能、科幻 |

---

## 并行生成模式

当配图数量 ≥ 8 张时，自动启用多 Agent 并行生成以提升效率。

详见：[references/multi-agent-generation.md](references/multi-agent-generation.md)

**核心思路**：
1. 主 Agent 分析文章内容并规划配图
2. 插入占位符 `[[ILLUSTRATION:ID:简短描述]]` 到文章
3. 解析占位符，按批次分发（每批 3-5 张）
4. 并行启动多个 Task Agent 生成
5. 主 Agent 按 ID 顺序收集并替换占位符

**启用条件**：
- 规划的配图数量 ≥ 8 张

---

## 核心工作流程

### 第一阶段：内容分析

1. 读取源文章 Markdown 文件
2. 识别核心概念和关键信息点
3. 规划配图位置：
   - 每个二级标题（##）后至少 1 张图
   - 每 2-3 个重要段落 1 张图
   - 重要概念转折点额外配图
   - 在规划位置插入占位符 `[[ILLUSTRATION:ID:简短描述]]`

4. 评估并选择生成模式：
   - ≥ 8 张 → 并行生成（多 Task Agent）
   - < 8 张 → 顺序生成

### 第二阶段：设计 SVG

1. 根据选择的输出模式应用相应规范
   - **jpg-export**：生成 SVG 代码用于后续 JPG 转换
   - **dynamic-svg**：添加 SMIL 动画效果
   - **static-svg**：生成静态 SVG 代码
   - **png-export**：生成 SVG 文件
2. 遵循共享设计原则：[references/core-principles.md](references/core-principles.md)

### 第三阶段：生成与输出

1. **解析占位符**：提取所有 `[[ILLUSTRATION:ID:描述]]`
2. **并行/顺序生成**：
   - ≥ 8 张：并行生成（多 Task Agent）
   - < 8 张：顺序生成
3. **替换占位符**：根据输出模式处理

> **默认行为**：使用 **jpg-export** 模式，生成 JPG 图片文件并插入 Markdown 引用。

- **jpg-export**（默认）：
  1. 生成 SVG 代码
  2. 使用 `scripts/svg2jpg.js` 转换为 JPG
  3. 在 Markdown 中插入图片引用 `![](配图/XX.jpg)`
- **dynamic-svg**：将 SVG 代码直接嵌入 Markdown 文件（使用 `<svg>` 标签）
- **static-svg**：将 SVG 代码直接嵌入 Markdown 文件（使用 `<svg>` 标签）
- **png-export**：
  1. 保存 SVG 文件到源文章目录
  2. 使用 `scripts/svg2png.js` 转换为 PNG
  3. 在 Markdown 中插入图片引用 `![](path.png)`

### 第四阶段：归档

每次完成配图生成后，将 SVG 代码提取并归档到 Skill 内部：

```bash
# 归档目录结构
.claude/skills/tkk-image/archive/YYYYMMDD_HHMMSS_文章名/
├── 1_配图名称.svg  # 提取的 SVG 文件
├── 2_配图名称.svg
└── ...
```

**归档命名规则**：

- 格式：`YYYYMMDD_HHMMSS_文章标题`
- 文章标题取自 Markdown 的第一个一级标题（`# 标题`），去除特殊字符
- SVG 文件命名：`序号_配图名称.svg`
- 示例：`20260209_163045_AI_Agent法律工作流未来范式/`
  - `1_AI_Agent_演进概览.svg`
  - `2_提示词设计.svg`
  - ...

---

## 共享设计原则

所有输出模式都遵循相同的核心设计原则，详见：[references/core-principles.md](references/core-principles.md)

核心要点：

- 概念聚焦：每张图只表达 1-2 个核心概念
- 极简设计：浅色主题，大图形，少文字
- 画布尺寸：800x450（16:9 比例）
- 边界控制：所有元素在有效区域内（60px 安全边距）

---

## 模式特定规范

### JPG Export 模式（默认）

生成独立的 JPG 图片文件。

详见：[references/jpg-export.md](references/jpg-export.md)

核心特性：

- 文件命名：`01.jpg`, `02.jpg` ...
- 保存位置：源文章目录的 `配图/` 子目录
- JPG 转换：使用 `scripts/svg2jpg.js`
- 图片质量：1600x900px, 95% 质量

### Dynamic SVG 模式

支持 SMIL 动画效果。

详见：[references/dynamic-svg.md](references/dynamic-svg.md)

核心特性：

- SMIL 动画：浮动、虚线流动、箭头绘制
- Emoji 动画：浮动、脉冲效果
- 逻辑性动画优先：箭头和虚线框必须有动画
- SVG 代码直接嵌入 Markdown

### Static SVG 模式

静态 SVG 代码直接嵌入 Markdown。

详见：[references/static-svg.md](references/static-svg.md)

核心特性：

- 无动画效果
- SVG 代码直接嵌入 Markdown
- 公众号完美支持

### PNG Export 模式

生成独立的 SVG 和 PNG 文件。

详见：[references/png-export.md](references/png-export.md)

核心特性：

- 文件命名：短名-序号.svg（≤15 字符）
- 保存位置：与源文章同目录
- PNG 转换：使用 `scripts/svg2png.js`
- 跨平台兼容性最佳

---

## JPG 转换脚本

使用 `scripts/svg2jpg.js` 进行高保真转换：

```bash
node scripts/svg2jpg.js input.svg [output.jpg] [dpi]
```

- **默认 DPI**：600
- **默认质量**：95%
- **支持**：emoji、中文、CSS
- **输出位置**：总是生成到源文件所在目录的 `配图/` 子目录

---

## PNG 转换脚本

使用 `scripts/svg2png.js` 进行高保真转换：

```bash
node scripts/svg2png.js input.svg [output.png] [dpi]
```

- **默认 DPI**：600
- **支持**：emoji、中文、CSS
- **输出位置**：总是生成到 SVG 源文件所在目录

---

## 成功标准

- 配图密度 10-15 张，有效增强视觉吸引力
- 每张配图概念聚焦准确
- 极简风格贯穿始终
- JPG 图片清晰度满足发布需求
- 公众号显示正常
