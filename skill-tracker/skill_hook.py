#!/usr/bin/env python3
"""
Skill Usage Tracker Hook
用于追踪 Claude Code 中 skill 的使用情况
"""
import sys
import json
import os
from datetime import datetime, timezone

TRACKER_DIR = os.path.expanduser("~/.claude/skills/skill-tracker")
USAGE_FILE = os.path.join(TRACKER_DIR, "skills_usage.json")

def load_usage():
    if os.path.exists(USAGE_FILE):
        with open(USAGE_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {"skills": {}}

def save_usage(data):
    with open(USAGE_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def update_skill(skill_name):
    data = load_usage()
    now = datetime.now(timezone.utc).isoformat()

    if skill_name not in data["skills"]:
        data["skills"][skill_name] = {
            "installed_at": None,
            "last_invoked": None,
            "invoke_count": 0,
            "first_invoked": None
        }

    s = data["skills"][skill_name]
    s["last_invoked"] = now
    s["invoke_count"] = s.get("invoke_count", 0) + 1
    if not s.get("first_invoked"):
        s["first_invoked"] = now

    save_usage(data)

def main():
    try:
        # 读取 stdin JSON 数据
        stdin_data = sys.stdin.read()
        if not stdin_data:
            sys.exit(0)

        data = json.loads(stdin_data)

        # 提取 skill 名称 - 正确的路径：tool_input.skill
        tool_input = data.get("tool_input", {})

        # 处理两种可能的格式
        # 格式1: {"skill": "tkk-case", "args": "--case xxx"}
        # 格式2: 直接在 tool_input 中
        skill_name = tool_input.get("skill") or tool_input.get("name")

        if skill_name:
            update_skill(skill_name)
        else:
            # 备用：从 args 字符串解析
            args = tool_input.get("args", "")
            if args and isinstance(args, str):
                skill_name = args.split()[0].strip()
                if skill_name:
                    update_skill(skill_name)

    except Exception:
        pass  # 静默失败，避免干扰主流程

if __name__ == "__main__":
    main()