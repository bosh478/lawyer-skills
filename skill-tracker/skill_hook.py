#!/usr/bin/env python3
import sys, json, subprocess

try:
    data = json.load(sys.stdin)
    args = data.get("tool_input", {}).get("args", "")
    if args:
        skill_name = args.split()[0].strip()
        if skill_name:
            tracker = "C:/Users/汤康康/.claude/skills/skill-tracker/skill_usage_tracker.py"
            subprocess.Popen(
                ["python", tracker, "--update", skill_name],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
except Exception:
    pass