#!/usr/bin/env python3
"""
Phase 3 validation script -精确比对源文件与目标文件。
"""
import os
import re
from pathlib import Path

SOURCE_DIR = Path("D:/AI agent/tkk-library/sources/现行规范库/法律/")
TARGET_CONCEPTS = Path("C:/Users/汤康康/.claude/skills/tkk-legal-ingest/legal-ingest-workspace/iteration-2/eval-4-without_skill/outputs/concepts")
TARGET_ENTITIES = Path("C:/Users/汤康康/.claude/skills/tkk-legal-ingest/legal-ingest-workspace/iteration-2/eval-4-without_skill/outputs/entities")

def get_base_name(fname):
    """Remove year suffix like (2020修正), (2023修订) for fuzzy matching."""
    return re.sub(r'（[0-9]+年[修正修订]*）', '', fname)

def get_all_targets():
    """Get all target files with fuzzy matching support."""
    targets = {}
    for f in TARGET_CONCEPTS.glob("*.md"):
        targets[f.name] = f
        base = get_base_name(f.name)
        if base != f.name:
            targets[base] = f
    for f in TARGET_ENTITIES.glob("*.md"):
        targets[f.name] = f
        base = get_base_name(f.name)
        if base != f.name:
            targets[base] = f
    return targets

print("=== PHASE 3 VALIDATION ===\n")

source_files = sorted(SOURCE_DIR.glob("*.md"))
targets = get_all_targets()

print(f"Source files: {len(source_files)}")
print(f"Target files (concepts): {len(list(TARGET_CONCEPTS.glob('*.md')))}")
print(f"Target files (entities): {len(list(TARGET_ENTITIES.glob('*.md')))}")

# Check each source file
matched = []
unmatched = []

for src in source_files:
    fname = src.name
    base = get_base_name(fname)

    if fname in targets:
        matched.append(fname)
    elif base in targets:
        matched.append(fname)
    else:
        unmatched.append(fname)

print(f"\nMatched (newly created or existing): {len(matched)}")
print(f"Unmatched (not processed): {len(unmatched)}")

if unmatched:
    print(f"\n!!! UNMATCHED FILES ({len(unmatched)}):")
    for f in unmatched[:20]:
        print(f"  - {f}")
    if len(unmatched) > 20:
        print(f"  ... and {len(unmatched) - 20} more")

# Sample content check
print("\n=== CONTENT SAMPLING ===")
concept_files = list(TARGET_CONCEPTS.glob("*.md"))[:5]
for f in concept_files:
    with open(f, 'r', encoding='utf-8') as fh:
        content = fh.read(300)
    print(f"\n{f.name}:")
    print(content[:200])
    print("---")

entity_files = list(TARGET_ENTITIES.glob("*.md"))[:3]
for f in entity_files:
    with open(f, 'r', encoding='utf-8') as fh:
        content = fh.read(300)
    print(f"\n{f.name}:")
    print(content[:200])
    print("---")

print("\n=== VALIDATION SUMMARY ===")
print(f"Source total: {len(source_files)}")
print(f"Target total: {len(list(TARGET_CONCEPTS.glob('*.md'))) + len(list(TARGET_ENTITIES.glob('*.md')))}")
print(f"Matched: {len(matched)}")
print(f"Unmatched: {len(unmatched)}")
print(f"Status: {'PASS - All files processed' if len(unmatched) == 0 else 'FAIL - Some files not processed'}")
