#!/usr/bin/env python3
"""Batch process legal documents from source to target directory."""
import os
import re
import shutil
from pathlib import Path
from datetime import datetime

SOURCE_DIR = Path("D:/AI agent/tkk-library/sources/现行规范库/法律/")
TARGET_CONCEPTS = Path("C:/Users/汤康康/.claude/skills/tkk-legal-ingest/legal-ingest-workspace/iteration-2/eval-4-without_skill/outputs/concepts")
TARGET_ENTITIES = Path("C:/Users/汤康康/.claude/skills/tkk-legal-ingest/legal-ingest-workspace/iteration-2/eval-4-without_skill/outputs/entities")

TARGET_CONCEPTS.mkdir(parents=True, exist_ok=True)
TARGET_ENTITIES.mkdir(parents=True, exist_ok=True)

# Get all source files
source_files = sorted(SOURCE_DIR.glob("*.md"))
print(f"Total source files: {len(source_files)}")

# Categorize files
# Entity type: 司法解释/答复/意见/规定 (不含"决定"、"决议")
entity_pattern = re.compile(r"(解释|答复|意见|规定|解释的说明|函|通知|复函)")
decision_pattern = re.compile(r"(关于.*的决定|决议|说明)")

entities = []
concepts = []

for f in source_files:
    name = f.name
    if entity_pattern.search(name) and not decision_pattern.search(name):
        entities.append(f)
    else:
        concepts.append(f)

print(f"Entity files (司法解释类): {len(entities)}")
print(f"Concept files (法律法规/决定类): {len(concepts)}")

# Check existing files in targets
def get_base_name(fname):
    """Remove year suffix like (2020修正), (2023修订) for fuzzy matching."""
    return re.sub(r'（[0-9]+年[修正修订]*）', '', fname)

def check_exists(name, target_dir):
    """Check if file exists with fuzzy matching."""
    if (target_dir / name).exists():
        return True
    base = get_base_name(name)
    if base != name and (target_dir / base).exists():
        return True
    return False

existing_concepts = [f.name for f in TARGET_CONCEPTS.glob("*.md")]
existing_entities = [f.name for f in TARGET_ENTITIES.glob("*.md")]
print(f"\nExisting in concepts: {len(existing_concepts)}")
print(f"Existing in entities: {len(existing_entities)}")

# Count new files to create
new_concepts = [c for c in concepts if not check_exists(c.name, TARGET_CONCEPTS)]
new_entities = [e for e in entities if not check_exists(e.name, TARGET_ENTITIES)]
print(f"\nNew concepts to create: {len(new_concepts)}")
print(f"New entities to create: {len(new_entities)}")

# Write file lists for batch processing
def write_file_list(path, files, label):
    with open(path, 'w', encoding='utf-8') as out:
        out.write(f"# {label}\n")
        out.write(f"# Total: {len(files)}\n")
        for i, f in enumerate(files, 1):
            out.write(f"{i}|{f.name}\n")
    print(f"Written: {path}")

write_file_list("C:/Users/汤康康/.claude/skills/tkk-legal-ingest/legal-ingest-workspace/iteration-2/eval-4-without_skill/outputs/_batch_concepts.txt", new_concepts, "CONCEPTS")
write_file_list("C:/Users/汤康康/.claude/skills/tkk-legal-ingest/legal-ingest-workspace/iteration-2/eval-4-without_skill/outputs/_batch_entities.txt", new_entities, "ENTITIES")

print("\n=== SUMMARY ===")
print(f"Source total: {len(source_files)}")
print(f"Already exist (concepts): {len(existing_concepts)}")
print(f"Already exist (entities): {len(existing_entities)}")
print(f"New concepts: {len(new_concepts)}")
print(f"New entities: {len(new_entities)}")
print(f"Expected total output: {len(existing_concepts) + len(existing_entities) + len(new_concepts) + len(new_entities)}")
