#!/usr/bin/env python3
"""
Skill Usage Tracker
用于追踪 Claude Code 中 skill 的使用情况

用法:
  python skill_usage_tracker.py --update <skill-name>    # 更新某 skill 的调用记录
  python skill_usage_tracker.py --list                  # 列出所有 skill 的使用情况
  python skill_usage_tracker.py --stale                  # 列出超过N天未使用的 skill
  python skill_usage_tracker.py --scan-history           # 从历史记录中扫描 skill 调用
"""

import json
import os
import sys
from datetime import datetime, timedelta

TRACKER_DIR = os.path.expanduser("~/.claude/skills/skill-tracker")
USAGE_FILE = os.path.join(TRACKER_DIR, "skills_usage.json")
HISTORY_FILE = os.path.expanduser("~/.claude/history.jsonl")

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
    now = datetime.utcnow().isoformat() + "Z"

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
    print(f"✓ Updated: {skill_name} (count: {s['invoke_count']})")

def list_skills():
    data = load_usage()
    today = datetime.now()

    print("\n{'=':<30} | {'installed':<12} | {'last_invoked':<20} | {'count':<6} | {'idle':<8}")
    print("-" * 90)

    for name, info in sorted(data["skills"].items()):
        installed = info.get("installed_at", "unknown")[:10] if info.get("installed_at") else "unknown"
        last = info.get("last_invoked", "never")[:19] if info.get("last_invoked") else "never"
        count = info.get("invoke_count", 0)
        idle = "?"

        if info.get("last_invoked"):
            last_dt = datetime.fromisoformat(info["last_invoked"].replace("Z", "+00:00"))
            days = (today - last_dt.replace(tzinfo=None)).days
            idle = f"{days}d"

        print(f"{name:<30} | {installed:<12} | {last:<20} | {count:<6} | {idle:<8}")

    print()

def list_stale(days=10):
    data = load_usage()
    today = datetime.now()
    stale = []

    for name, info in data["skills"].items():
        if not info.get("last_invoked"):
            # 从未调用
            if info.get("installed_at"):
                installed_dt = datetime.fromisoformat(info["installed_at"])
                days_since = (today - installed_dt).days
                if days_since >= days:
                    stale.append((name, days_since, "installed"))
            continue

        last_dt = datetime.fromisoformat(info["last_invoked"].replace("Z", "+00:00"))
        days_idle = (today - last_dt.replace(tzinfo=None)).days
        if days_idle >= days:
            stale.append((name, days_idle, "last invoked"))

    if stale:
        print(f"\n超过 {days} 天未使用的 skill ({len(stale)} 个):")
        print("-" * 50)
        for name, d, reason in sorted(stale, key=lambda x: -x[1]):
            print(f"  {name:<35} {d} 天未使用 ({reason})")
    else:
        print(f"\n没有超过 {days} 天未使用的 skill")

    print()

def scan_history():
    """从 history.jsonl 中扫描 skill 调用记录"""
    data = load_usage()
    skill_patterns = [
        '"/', '/', 'skill ', 'Skill'
    ]

    if not os.path.exists(HISTORY_FILE):
        print(f"历史文件不存在: {HISTORY_FILE}")
        return

    skill_calls = {}

    with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
        for line in f:
            if not line.strip():
                continue
            try:
                entry = json.loads(line)
                display = entry.get('display', '')
                timestamp = entry.get('timestamp', 0)

                # 检测 skill 调用
                for pattern in ['/', 'skill ', 'Skill']:
                    if display.startswith(pattern) or display.startswith('调用 '):
                        # 提取 skill 名称
                        parts = display.lstrip('/').split()
                        if parts:
                            skill_name = parts[0].lower()
                            if skill_name not in skill_calls:
                                skill_calls[skill_name] = {"count": 0, "first": timestamp, "last": timestamp}
                            skill_calls[skill_name]["count"] += 1
                            skill_calls[skill_name]["last"] = max(skill_calls[skill_name]["last"], timestamp)
            except:
                continue

    print(f"\n从历史记录中扫描到 {len(skill_calls)} 个 skill 的调用:")
    for name, info in sorted(skill_calls.items(), key=lambda x: -x[1]["count"]):
        dt_first = datetime.fromtimestamp(info["first"]/1000).strftime("%Y-%m-%d")
        dt_last = datetime.fromtimestamp(info["last"]/1000).strftime("%Y-%m-%d")
        print(f"  {name:<30} {info['count']:>4} 次 | 首次: {dt_first} | 最近: {dt_last}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        list_skills()
    elif sys.argv[1] == "--update" and len(sys.argv) >= 3:
        update_skill(sys.argv[2])
    elif sys.argv[1] == "--stale":
        days = int(sys.argv[2]) if len(sys.argv) > 2 else 10
        list_stale(days)
    elif sys.argv[1] == "--scan-history":
        scan_history()
    elif sys.argv[1] == "--help":
        print(__doc__)
    else:
        list_skills()