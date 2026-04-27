# Skills Manager Skill

## /skills
List all installed skills with their status and paths.

Run `ls -la .claude/skills/` to enumerate all skills, then for each skill found, check if it has a SKILL.md or skill.md file and report its status (configured or raw).

## /skill-install
Install a skill directly from a zip file without auditing.

Usage: `/skill-install <path-to-zip>`

Extract the zip to `.claude/skills/<skill-name>/`, create the skill structure if needed.

## /skill-update
Check for skill updates by comparing installed versions against known sources.

Report which skills have updates available.
