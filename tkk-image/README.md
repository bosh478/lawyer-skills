# tkk-image - AI 文章配图生成工具

AI 驱动的文章配图生成工具，使用 SVG 技术为文章生成高质量配图，默认输出 JPG 图片文件。

## 安装

```bash
# 克隆到 skill 目录
git clone https://github.com/bosh478/lawyer-skills.git ~/.claude/skills/tkk-image
cd ~/.claude/skills/tkk-image

# 安装依赖（jpg-export 模式需要）
npm install
```

## 使用

在 Claude Code 中使用 `/tkk-image` 命令：

```
/tkk-image @path/to/article.md
```

## 输出模式

| 模式 | 说明 |
|------|------|
| **jpg-export**（默认） | 生成 JPG 图片文件 |
| **dynamic-svg** | 嵌入带动画的 SVG |
| **static-svg** | 嵌入静态 SVG |
| **png-export** | 生成 PNG 图片文件 |

## 依赖

| 模式 | 依赖 |
|------|------|
| jpg-export | Node.js + sharp (`npm install sharp`) |
| dynamic-svg | 无 |
| static-svg | 无 |
| png-export | Node.js + puppeteer |

详细文档请查看 [SKILL.md](SKILL.md)