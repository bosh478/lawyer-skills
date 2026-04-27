---
name: tkk-case
description: 法律案件全流程处理技能。接收任意案件素材 → 与用户讨论沟通 → 调用 tkk-legal-ingest 分析问题（如无答案则用 web-access 检索）→ 生成结构化法律分析文章 → 生成配图 → 存入vault问答目录。触发场景：用户说"分析这个案子"、"生成法律文章"、"整理案例分析"。
---

# tkk-case (v4)

> 全流程法律案件分析技能：素材 → 沟通确认 → 分析 → 文章 → 配图 → vault入库

---

## 核心功能

1. **接收任意素材**：支持任意案件素材文件输入（不限来源、不限格式）
2. **沟通确认**：在关键节点与用户确认方向和偏好
3. **问题分析**：调用 `tkk-legal-ingest` 分析问题，必要时用 `web-access` 检索网络资源
4. **生成文章**：按结构化模板生成法律分析文章
5. **生成配图**：调用 `baoyu-imagine` 生成配图（张数不限，默认.jpg）
6. **存入vault**：文章存入 `wiki/问答/`、图片存入 `wiki/问答/images/`

---

## 输入参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `case_file` | string | ✅ | 案件素材文件路径（任意文件） |
| `case_file2` | string | ❌ | 第二个案件素材文件路径（如有对比案例） |
| `author` | string | ❌ | 作者，默认"汤康康" |
| `article_title` | string | ❌ | 文章标题，默认从素材提取 |

---

## 工作流程

### Step 1 — 接收并解析素材

**读取文件**：
- 读取 `case_file` → 识别案件类型（职务侵占/诈骗/盗窃等）
- 读取 `case_file2`（如提供）→ 提取对比案例信息

**识别案件类型**：

| 素材关键词 | 识别类型 | 分析框架 |
|-----------|---------|---------|
| 出纳/职务便利/挪用资金 | 职务侵占/挪用资金 | 两阶层 + 善意取得 |
| 诈骗/欺诈/虚构事实 | 诈骗罪 | 诈骗罪构成要件 + 刑民交叉 |
| 盗窃/秘密窃取 | 盗窃罪 | 盗窃罪构成要件 + 数额标准 |
| 借款/借贷/合同 | 合同诈骗/民事纠纷 | 刑民交叉 + 合同效力 |
| 网络打赏/直播/充值 | 网络直播打赏型犯罪 | 善意取得 + 追赃条件 |

---

### Step 1.5 — 沟通确认（关键节点）

**与用户确认以下内容**：

1. **案件理解确认**：
   - 识别出的案件类型是否正确？
   - 涉及的核心法律问题是什么？
   - 是否有特定的辩护方向或关注重点？

2. **分析框架确认**：
   - 使用两阶层还是三阶层分析框架？
   - 是否需要刑民交叉分析？
   - 是否需要对比案例参考？

3. **文章结构确认**：
   - 文章标题是否合适？
   - 是否有特定章节需要增减？
   - 作者署名是否正确？

4. **配图需求确认**：
   - 需要几张配图？（默认3张）
   - 配图风格偏好？
   - 是否有特定内容需要配图？

**沟通方式**：使用 `AskUserQuestion` 工具向用户提问，等待用户确认后继续。

---

### Step 2 — 问题分析

**vault知识库查引用**（Read-Only）：

| vault 文件 | 用途 |
|-----------|------|
| `wiki/concepts/` | 相关罪名概念页 |
| `wiki/entities/` | 相关司法解释 entity 页 |
| `wiki/syntheses/` | 相关案例分析 synthesis 页 |
| `wiki/summaries/` | 相关律师业务指引 summary 页 |

**分析流程**：

1. 读取 vault wiki 相关页面，提取相关法律知识
2. 基于 wiki 知识库进行法律问题分析
3. 识别涉及的罪名、法条、司法解释
4. 校验法律数字准确性（数额标准、量刑档次等）

**与用户讨论问题**：
- 分析过程中发现的问题点与用户讨论
- 确认法律适用是否正确
- 确认量刑建议是否合理

**⚠️ 网络检索 fallback**：
- 调用 `tkk-legal-ingest` 分析时，如 vault 知识库无适当答案
- **必须调用 `web-access` skill 检索网络资源**
- 不得仅回复"知识库无答案"而不进行网络检索

---

### Step 3 — 生成结构化文章

**分析框架**：
- 根据案件类型，自动选择两阶层/三阶层分析框架
- 根据涉及罪名，调用 wiki 知识库进行构成要件分析
- 根据请求权基础思维，进行善意取得/追赃条件分析

**文章结构**：

```markdown
# {文章标题}

**作者：{author}**

---

## 引言：{案件概述}

[基于素材提取的关键事实]

## 一、案情对比：{本案与类案的相似性}

[类案对比表格]

## 二、案例先行：{相关裁判要旨}

[直接引用相关案例的裁判要旨原文]

## 三、{涉案款项/行为}是否构成赃款/犯罪的认定标准

[两阶层犯罪论体系分析 / 三阶层分析]

## 四、{追赃/定罪}的法律条件分析

[善意取得制度分析 + 请求权基础思维]

## 五、本案的特殊性与{追回/定罪}可行性分析

[与类案关键差异 + 建议策略]

## 结语

[总结 + 行业警示]
```

**必须引用的 wiki 页面**（通过 wikilink）：
- `[[concept_相关罪名]]` — 构成要件分析
- `[[entity_相关司法解释]]` — 法律依据
- `[[synthesis_相关案例分析]]` — 类案参考
- `[[Court_入库案例_案号]]` — 裁判要旨

---

### Step 3.5 — 文章确认

**与用户确认**：
- 文章内容是否准确？
- 是否有需要补充或修改的地方？
- 是否需要调整章节结构？

---

### Step 4 — 生成配图

**调用 baoyu-imagine + MiniMax API 生成配图**。

**⚠️ 重要：必须使用 wrapper 脚本执行**

```bash
~/.baoyu-skills/baoyu-imagine/run-with-env.sh [args]
```

**禁止直接调用** `bun ~/.claude/skills/baoyu-imagine/scripts/main.ts`，否则环境变量无法正确加载。

**baoyu-imagine 配置检查**：
1. 确认 `~/.baoyu-skills/.env` 存在且包含 `MINIMAX_API_KEY` 和 `MINIMAX_BASE_URL`
2. 确认 `~/.baoyu-skills/baoyu-imagine/EXTEND.md` 已配置
3. 详情参见 `~/.baoyu-skills/baoyu-imagine/TROUBLESHOOTING.md`

**配图参数**：
- **格式**：默认 `.jpg`（可用户指定 `.png`）
- **张数**：默认3张，根据文章结构覆盖标题页、案情对比、法律框架等；用户可指定张数
- **尺寸**：默认 16:9，可指定
- **质量**：默认 2k

**图片生成命令示例**：

```bash
~/.baoyu-skills/baoyu-imagine/run-with-env.sh \
  --prompt "Professional legal infographic, dark blue background, Chinese text '标题内容', title page style" \
  --image "wiki/问答/images/{案件关键词}-01.jpg" \
  --provider minimax --model image-01 --ar 16:9 --quality 2k
```

**批量生成**：每次调用后检查输出，确认成功后再生成下一张。

**错误处理**：
- `invalid api key` → 检查 `.env` 文件或使用 wrapper 重新执行
- 生成失败 → 重试最多3次

---

### Step 4.5 — 配图确认

**与用户确认**：
- 配图内容是否合适？
- 是否需要重新生成某张图片？
- 是否需要调整配图风格？

---

### Step 5 — 插入配图引用

在文章适当位置插入 markdown 图片引用：

```markdown
<!-- 配图：文章标题页 -->
![](images/{案件关键词}-01.jpg)

<!-- 配图：案情对比表 -->
![](images/{案件关键词}-02.jpg)

<!-- 配图：法律框架图 -->
![](images/{案件关键词}-03.jpg)
```

---

### Step 6 — 输出到 vault

```
wiki/问答/
├── {synthesis_案件关键词}.md  ← 文章输出
└── images/                    ← 配图目录
    ├── {案件关键词}-01.jpg  (标题页)
    ├── {案件关键词}-02.jpg  (案情对比表)
    └── {案件关键词}-03.jpg  (法律框架)
```

---

## 沟通节点汇总

| 节点 | 确认内容 | 工具 |
|------|---------|------|
| Step 1.5 | 案件理解、分析框架、文章结构、配图需求 | `AskUserQuestion` |
| Step 2 | 法律问题分析方向、量刑建议 | 讨论式沟通 |
| Step 3.5 | 文章内容准确性、章节调整 | `AskUserQuestion` |
| Step 4.5 | 配图内容、风格调整 | `AskUserQuestion` |

---

## 调用示例

### 完整调用

```
/tkk-case --case "C:\Users\汤康康\Desktop\新案件素材.md" --author 汤康康
```

### 多文件调用

```
/tkk-case --case "C:\Users\汤康康\Desktop\素材.md" --case2 "C:\Users\汤康康\Desktop\对比案例.txt"
```

### 指定配图张数

```
/tkk-case --case "C:\Users\汤康康\Desktop\素材.md" --image-count 5
```

### Skill Tool 调用

```json
{
  "skill": "tkk-case",
  "args": "--case C:\\Users\\汤康康\\Desktop\\新案件素材.md --author 汤康康"
}
```

---

## 内部依赖

| 依赖 | 用途 | 调用方式 |
|------|------|---------|
| `tkk-legal-ingest` | 问题分析 + vault查引用 | Read vault wiki 文件 + 分析逻辑 |
| `web-access` | 网络检索 | 当 tkk-legal-ingest 无适当答案时必须调用 |
| `baoyu-imagine` | 生成配图 | 必须用 `~/.baoyu-skills/baoyu-imagine/run-with-env.sh` 执行 |

---

## 案件类型自动识别

| 素材特征 | 识别的案件类型 | 分析框架 |
|----------|---------------|---------|
| 出纳/职务便利/挪用资金 | 职务侵占/挪用资金 | 两阶层犯罪论 + 善意取得 |
| 诈骗/欺诈/虚构事实 | 诈骗罪 | 诈骗罪构成要件 + 刑民交叉 |
| 盗窃/秘密窃取 | 盗窃罪 | 盗窃罪构成要件 + 数额标准 |
| 借款/借贷/合同 | 合同诈骗/民事纠纷 | 刑民交叉分析 + 合同效力 |
| 网络打赏/直播/充值 | 网络直播打赏型犯罪 | 善意取得 + 追赃条件 |

---

## 错误处理

| 错误 | 处理方式 |
|------|---------|
| 素材文件不存在 | 报错并终止，提示用户检查路径 |
| vault引用文件不存在 | 警告后继续，跳过wikilink |
| 法律数字与vault不符 | 以vault wiki为准，标注差异并说明 |
| vault无答案 | **必须调用 web-access 检索网络资源**，不得跳过 |
| baoyu-imagine 失败 | 使用 wrapper 重试最多3次；确认 `.env` 配置正确 |
| `invalid api key` | 检查 `~/.baoyu-skills/.env` 中的 `MINIMAX_API_KEY` 和 `MINIMAX_BASE_URL` |

---

## 版本历史

| 版本 | 日期 | 变化 |
|------|------|------|
| v5 | 2026-04-27 | 增加沟通确认环节；配图不限于张数、默认.jpg格式；vault无答案时必须调用web-access检索 |
| v4 | 2026-04-27 | 重命名为 tkk-case（原 tkk-legal-article-pipeline）；替换 svg-article-illustrator 为 baoyu-imagine；必须使用 wrapper 脚本执行 |
| v3 | 2026-04-27 | 替换 svg-article-illustrator 为 baoyu-imagine；必须使用 wrapper 脚本执行；添加配置检查和错误处理 |
| v2 | 2026-04-22 | 支持任意素材输入；调用tkk-legal-ingest进行问题分析 |
| v1 | 2026-04-21 | 初始版本 |

---

## 执行纪律

### Git 备份纪律（强制）

**⚠️ 重要：每次对 skill.md 进行任何修改前，必须先执行 git 备份。**

| 迭代类型 | 备份时机 | 备份命令 |
|---------|---------|---------|
| 重大功能迭代 | 修改 skill.md **前** | `git add -A && git commit -m "backup: {变更描述}"` |
| 小幅调整 | 修改 skill.md **前** | `git add -A && git commit -m "backup: {变更描述}"` |
| 批量修改 | 修改前统一备份 | `git add -A && git commit -m "backup: 批量修改前"` |

**回滚命令**：

```bash
# 查看历史
git log --oneline

# 回滚到指定版本
git reset --hard <commit-hash>

# 回滚单个文件
git checkout <commit-hash> -- .claude/skills/tkk-case/skill.md
```

**验证流程**：
1. 修改前执行 `git status` 确认工作区干净
2. 备份后执行 `git log --oneline -1` 确认提交成功
3. 如需回滚，使用上述回滚命令

---

## 相关技能

- [tkk-legal-ingest](../tkk-legal-ingest/skill.md) — 法律文档消化 + 问题分析
- [web-access](../web-access/skill.md) — 网络检索（vault无答案时必须调用）
- [baoyu-imagine](https://github.com/JimLiu/baoyu-skills#baoyu-imagine) — 文章配图生成（必须用 wrapper 执行）
- [tkk-article-polish](../tkk-article-polish/skill.md) — 文章润色
