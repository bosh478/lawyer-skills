---
name: mineru-ocr
homepage: https://github.com/cat-xierluo/legal-skills
author: 陆律师（微信ywxlawyer）
version: "1.3.0"
description: 将法律文档（PDF/图片/远程 URL/网页 URL）转换为 Markdown。默认使用免费接口（无需配置），有 Token 时自动切换到标准 API。归档目录自动管理，支持 Token 验证和私有部署说明。
license: Complete terms in LICENSE.txt
---
# MinerU PDF 转 Markdown

## 功能说明

通过 MinerU 将法律文档转换为 Markdown 格式，支持：

- Auto 模式：无 Token 时自动使用免费接口，有 Token 时自动切换到标准 API
- PDF、DOC、DOCX、PPT、PPTX、PNG、JPG、JPEG
- 本地文件、远程文档 URL、网页 URL
- OCR 文字识别、表格识别、数学公式识别
- 自动归档到 archive 目录，保存原始文件、图片清单

## 系统要求

| 系统 | 要求 |
|------|------|
| **Windows** | Node.js 16+（已测试 v24） |
| **macOS** | Node.js 16+，或 osascript（JXA） |
| **Linux** | Node.js 16+ |

## 使用方法

```bash
# Windows/Mac/Linux 通用
node .claude/skills/mineru-ocr/scripts/convert.js "/path/to/file.pdf"
node .claude/skills/mineru-ocr/scripts/convert.js "https://cdn-mineru.openxlab.org.cn/demo/example.pdf"
node .claude/skills/mineru-ocr/scripts/convert.js "https://example.com/article"
node .claude/skills/mineru-ocr/scripts/convert.js checktoken
```

## 配置选项

编辑 `.claude/skills/mineru-ocr/config/.env`：

| 选项 | 默认值 | 说明 |
|------|--------|------|
| MINERU_API_TOKEN | 空 | 可选填写以启用标准 API |
| MINERU_ENABLE_OCR | true | 启用 OCR |
| MINERU_ENABLE_TABLE | true | 启用表格识别（标准 Token API 有效） |
| MINERU_ENABLE_FORMULA | false | 启用公式识别（标准 Token API 有效） |
| MINERU_LANGUAGE_CODE | zh | 文档语言 |
| MINERU_API_BASE | `https://mineru.net/api/v4` | 标准 API 地址 |
| MINERU_MODEL_VERSION | `pipeline` | 标准 Token API 模型（文档转换默认 `pipeline`） |
| MINERU_PAGE_RANGES | 空 | 标准 Token API 页码范围，如 `1-20`、`2,4-6` |
| MINERU_POLL_MAX | 20 | 最大轮询次数 |
| MINERU_POLL_SLEEP | 10 | 轮询间隔（秒） |
| MINERU_LOG_LEVEL | medium | 日志级别 |

## 输出规则

- **本地文件**：Markdown 保存到源文件同目录
- **远程 URL / 网页 URL**：Markdown 默认保存到执行命令时的当前目录
- **归档目录**：`.claude/skills/mineru-ocr/archive/日期_时间_文件名/`
- **归档内容**：转换得到的 Markdown、原始输入文件、以及提取到的图片资源清单

## Token 验证

```bash
node .claude/skills/mineru-ocr/scripts/convert.js checktoken
```

- 未配置 Token → 显示当前为免费接口模式
- Token 有效 → 显示已成功连接
- Token 过期 → 正确提示并建议降级为免费接口

## 私有化部署 / 自定义网关

当前 skill 只能接入 **MinerU 官方 v4 API**。

如需接入私有化转换服务（如部署 `mineru-api` / `mineru-router` 等），需要自行改造脚本以对接 `/tasks`、`/file_parse` 等接口——**超出当前 skill 支持范围**。建议路径：

- 直接使用官方 CLI / SDK 接入
- 或改造脚本只维护私有化模式，不与官方逻辑混合

## 已知限制

| 问题 | 说明 |
|------|------|
| 免费接口限流 | IP 限流时自动降级为标准 API |
| 文件过大 / 页数过长 | 标准 Token API 支持更大文件（200 MB / 600 页），免费接口限 10 MB / 20 页 |
| 网页 URL 无法处理 | 接口不支持 HTML，配置 Token 后可尝试 |
| 401/Unauthorized | Token 已过期，删除并重新配置 |
| 转换超时 | 增大 `MINERU_POLL_MAX` 或确认文件未损坏 |
| 余额不足 | 检查 MinerU 账户余额 |
