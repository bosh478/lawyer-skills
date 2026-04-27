#!/usr/bin/env python3
"""
Legal document batch processor - generates Agent commands for parallel processing.
Reads from _batch_concepts.txt and _batch_entities.txt, outputs agent batch scripts.
"""
import os
import re
from pathlib import Path

OUTPUT_DIR = Path("C:/Users/汤康康/.claude/skills/tkk-legal-ingest/legal-ingest-workspace/iteration-2/eval-4-without_skill/outputs")
SOURCE_DIR = Path("D:/AI agent/tkk-library/sources/现行规范库/法律/")
TARGET_CONCEPTS = OUTPUT_DIR / "concepts"
TARGET_ENTITIES = OUTPUT_DIR / "entities"

BATCH_SIZE = 40  # Max files per Agent batch

def get_base_name(fname):
    return re.sub(r'（[0-9]+年[修正修订]*）', '', fname)

def sanitize_title(name):
    """Convert filename to title for frontmatter."""
    # Remove .md
    title = name.replace('.md', '')
    return title

def process_concept_file(src_path, target_path):
    """Process a single concept file."""
    with open(src_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Extract frontmatter if exists
    frontmatter_end = content.find('---', 3)
    existing_frontmatter = ""
    body = content
    if content.startswith('---') and frontmatter_end > 0:
        existing_frontmatter = content[3:frontmatter_end]
        body = content[frontmatter_end + 3:]

    fname = src_path.name
    title = sanitize_title(fname)
    base_clean = get_base_name(fname)
    if base_clean != fname:
        display_title = f"{base_clean}（{fname[len(base_clean):].replace('.md','')}）"
    else:
        display_title = title

    # Determine tags based on content/law type
    tags = ["法律", "实体法"]
    if "刑事诉讼法" in fname or "民事诉讼法" in fname or "行政诉讼法" in fname:
        tags = ["法律", "程序法"]
    elif "决定" in fname or "决议" in fname:
        tags = ["法律修改决定", "立法"]
    elif "全国人民代表大会" in fname or "全国人大常委会" in fname:
        tags = ["宪法", "人大制度"]
    elif any(x in fname for x in ["刑法", "刑罚", "犯罪"]):
        tags = ["刑法", "实体法"]

    now = "2026-04-16"

    # Build frontmatter
    new_frontmatter = f"""---
title: {display_title}
type: concept
created: {now}
updated: {now}
tags: [{', '.join(tags)}]
source: [[{fname}]]
---

"""

    # Extract chapter structure (lines that look like ## or ### followed by Chinese)
    lines = body.split('\n')
    chapter_lines = []
    key_articles = []

    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith('##') or stripped.startswith('#'):
            chapter_lines.append(stripped)
        # Look for article patterns like "第X条" or "第X章"
        if re.match(r'^第[一二三四五六七八九十百零〇\\d]+条', stripped) or \
           re.match(r'^第[一二三四五六七八九十百零〇\\d]+章', stripped):
            if len(stripped) > 5 and len(stripped) < 500:
                key_articles.append(stripped[:200])

    # Build output
    output = new_frontmatter

    if chapter_lines:
        output += "## 章节结构\n" + "\n".join(chapter_lines[:20]) + "\n\n"
    if key_articles:
        output += "## 关键条款\n"
        for art in key_articles[:30]:
            output += f"- {art}\n"
        output += "\n"

    # Add section on legal amendments if it's a decision file
    if "关于修改" in fname or "决定" in fname:
        output += "## 修改内容摘要\n"
        output += "本文为法律修改决定，详情见源文件。\n"

    # If body is too short, add a note
    if len(body.strip()) < 100:
        output += "## 全文\n" + body.strip()[:500] + "\n"

    with open(target_path, 'w', encoding='utf-8') as f:
        f.write(output)

def process_entity_file(src_path, target_path):
    """Process a single entity file (司法解释)."""
    with open(src_path, 'r', encoding='utf-8') as f:
        content = f.read()

    fname = src_path.name
    title = sanitize_title(fname)

    # Determine tags
    tags = ["司法解释"]
    if "刑法" in fname:
        tags.append("刑法")
    if "最高人民检察院" in fname or "最高检" in fname:
        tags.append("最高检")
    if "最高人民法院" in fname or "最高法" in fname:
        tags.append("最高法")

    now = "2026-04-16"

    new_frontmatter = f"""---
title: {title}
type: entity
created: {now}
updated: {now}
tags: [{', '.join(tags)}]
source: [[{fname}]]
---

"""

    # Extract key content
    lines = content.split('\n')
    key_content = []
    article_lines = []

    for line in lines:
        stripped = line.strip()
        if len(stripped) > 5 and len(stripped) < 400:
            if re.match(r'^第[一二三四五六七八九十百零〇\\d]+条', stripped) or \
               re.match(r'^\d+、', stripped) or \
               re.match(r'^[一二三四五六七八九十]+、', stripped):
                article_lines.append(stripped)
            elif len(key_content) < 20:
                key_content.append(stripped)

    output = new_frontmatter
    if article_lines:
        output += "## 解释条款\n"
        for art in article_lines[:30]:
            output += f"- {art}\n"
        output += "\n"
    if key_content:
        output += "## 关键内容\n" + "\n".join(key_content[:15]) + "\n"

    with open(target_path, 'w', encoding='utf-8') as f:
        f.write(output)

def main():
    # Process concepts in batches
    concepts_list = OUTPUT_DIR / "_batch_concepts.txt"
    with open(concepts_list, 'r', encoding='utf-8') as f:
        lines = f.readlines()[2:]  # Skip header lines

    files_by_batch = {}
    for i, line in enumerate(lines):
        parts = line.strip().split('|')
        if len(parts) < 2:
            continue
        idx = int(parts[0])
        fname = parts[1]
        batch_num = (idx - 1) // BATCH_SIZE
        if batch_num not in files_by_batch:
            files_by_batch[batch_num] = []
        files_by_batch[batch_num].append(fname)

    print(f"Concept batches: {len(files_by_batch)}")
    for batch_num in sorted(files_by_batch.keys()):
        files = files_by_batch[batch_num]
        print(f"  Batch {batch_num}: {len(files)} files")

    # Process entities (single batch)
    entities_list = OUTPUT_DIR / "_batch_entities.txt"
    with open(entities_list, 'r', encoding='utf-8') as f:
        ent_lines = f.readlines()[2:]

    print(f"\nEntity batches: 1 ({len(ent_lines)} files)")

    # Process all files
    print("\n=== Processing Concepts ===")
    for batch_num in sorted(files_by_batch.keys()):
        files = files_by_batch[batch_num]
        for fname in files:
            src = SOURCE_DIR / fname
            tgt = TARGET_CONCEPTS / fname
            if not tgt.exists():
                try:
                    process_concept_file(src, tgt)
                except Exception as e:
                    print(f"ERROR {fname}: {e}")

    print("\n=== Processing Entities ===")
    for line in ent_lines:
        parts = line.strip().split('|')
        if len(parts) < 2:
            continue
        fname = parts[1]
        src = SOURCE_DIR / fname
        tgt = TARGET_ENTITIES / fname
        if not tgt.exists():
            try:
                process_entity_file(src, tgt)
            except Exception as e:
                print(f"ERROR {fname}: {e}")

    # Count results
    concept_count = len(list(TARGET_CONCEPTS.glob("*.md")))
    entity_count = len(list(TARGET_ENTITIES.glob("*.md")))
    print(f"\n=== RESULTS ===")
    print(f"Concepts created: {concept_count}")
    print(f"Entities created: {entity_count}")
    print(f"Total output: {concept_count + entity_count}")
    print(f"Source total: 391")

if __name__ == "__main__":
    main()
