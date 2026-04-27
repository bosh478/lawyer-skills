#!/usr/bin/env python3
"""
Skill Hook Debug - 诊断 hook 接收到的数据格式
"""
import sys
import json
import os
from datetime import datetime

DEBUG_FILE = os.path.expanduser("~/.claude/skills/skill-tracker/hook_debug.log")

def log(msg):
    with open(DEBUG_FILE, 'a', encoding='utf-8') as f:
        f.write(f"[{datetime.now().isoformat()}] {msg}\n")

log("=== Hook called ===")
log(f"sys.stdin.read(): {repr(sys.stdin.read())}")

# 尝试重新读取 stdin（如果已经读取过可能为空）
stdin_data = sys.stdin.read() if not sys.stdin.read() else ""
log(f"stdin: {repr(stdin_data[:500] if stdin_data else 'empty')}")

# 检查环境变量
log(f"ENV: {dict(os.environ)}")