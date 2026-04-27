---
name: skill-tracker
description: Skill 使用情况追踪器 — 记录安装时间、调用次数、最后调用时间
type: reference
---

# Skill 使用追踪

## 数据文件
`~/.claude/skills/skill-tracker/skills_usage.json`

## 数据结构
```json
{
  "skills": {
    "skill-name": {
      "installed_at": "2026-03-31",
      "last_invoked": "2026-04-26T14:30:00Z",
      "invoke_count": 15,
      "first_invoked": "2026-04-14T09:00:00Z"
    }
  }
}
```

## 维护方式
- 安装新 skill 时，由 skill-creator 或手动添加记录
- 每次调用 skill 时更新 last_invoked 和 invoke_count
- 定期从 skills/ 目录扫描补充 installed_at（目录创建时间）