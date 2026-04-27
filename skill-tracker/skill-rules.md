# Skill 使用追踪规则

## 规则

1. **每次调用 Skill 工具时**，hook 自动更新 `~/.claude/skills/skill-tracker/skills_usage.json`
2. **每10天**自动汇总一次 skill 使用情况，报告超过10天未使用的 skill
3. **新安装 skill** 时，同步更新 skills_usage.json 的 installed_at
4. **删除 skill** 时，从 skills_usage.json 中移除对应记录

---

## Git 版本备份规则（版本迭代前必须遵守）

### 备份时机
在进行以下操作前，**必须先备份当前版本**：
- 版本迭代优化
- 代码重构
- 依赖升级
- 配置文件修改

### 备份方式
```bash
# 方式一：提交当前状态作为备份点
git add -A
git commit -m "backup: pre-optimization $(date +%Y%m%d%H%M%S)"

# 方式二：创建备份 tag
git tag backup/YYYYMMDD-HHMMSS
```

### 回滚命令
```bash
# 回滚到上一个备份版本
git reset --hard HEAD~1

# 或回滚到指定 tag
git reset --hard backup/YYYYMMDD-HHMMSS
```

### 执行确认
每次版本迭代前，主动向用户确认：
> "即将进行版本迭代，是否先备份当前版本？"

## 数据文件

- `~/.claude/skills/skill-tracker/skills_usage.json`
- `~/.claude/skills/skill-tracker/skill_usage_tracker.py`

## 查询命令

- 查看超过N天未使用：`python skill_usage_tracker.py --stale <天数>`
- 查看所有使用情况：`python skill_usage_tracker.py --list`
- 手动更新记录：`python skill_usage_tracker.py --update <skill-name>`