#!/usr/bin/env python3
"""Decode and display GitHub API responses"""

import base64
import json
import urllib.request
import urllib.error

headers = {
    'User-Agent': 'Mozilla/5.0',
    'Accept': 'application/vnd.github.v3+json'
}

urls = [
    ('GitHub Skills Repo Info', 'https://api.github.com/repos/anthropics/skills'),
    ('SKILL.md', 'https://api.github.com/repos/anthropics/skills/contents/skills/skill-creator/SKILL.md'),
    ('package_skill.py', 'https://api.github.com/repos/anthropics/skills/contents/skills/skill-creator/scripts/package_skill.py'),
    ('quick_validate.py', 'https://api.github.com/repos/anthropics/skills/contents/skills/skill-creator/scripts/quick_validate.py'),
]

for label, url in urls:
    print(f'\n=== {label} ===')
    print(f'URL: {url}')
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            if label == 'GitHub Skills Repo Info':
                print(f'Stars: {data.get("stargazers_count")}')
                print(f'Forks: {data.get("forks_count")}')
                print(f'Updated: {data.get("updated_at")}')
                print(f'Description: {data.get("description")}')
            else:
                if 'content' in data:
                    content = base64.b64decode(data['content']).decode('utf-8')
                    print(content[:2000] if len(content) > 2000 else content)
                else:
                    print(json.dumps(data, indent=2)[:2000])
    except Exception as e:
        print(f'ERROR: {e}')