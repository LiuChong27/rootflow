#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
ROOTS_DIR = REPO_ROOT / "data" / "roots"
RAW_ROOTS_PATH = REPO_ROOT / "data" / "raw" / "roots-hierarchy-fixed.json"
RAW_WORDS_PATH = REPO_ROOT / "data" / "raw" / "words-flat-fixed.json"
VIBES_JSON_PATHS = [
    REPO_ROOT / "data" / "vibes" / "scene-cards.json",
    REPO_ROOT / "data" / "vibes" / "scene-library.json",
]
TEXT_REPAIR_PATHS = [
    REPO_ROOT / "App.vue",
    REPO_ROOT / "pages" / "today" / "today.vue",
    REPO_ROOT / "pages" / "learning" / "learning.vue",
    REPO_ROOT / "pages" / "practice" / "practice.vue",
    REPO_ROOT / "pages" / "vibes" / "vibes.vue",
    REPO_ROOT / "pages" / "vibes" / "scene.vue",
    REPO_ROOT / "pages" / "vibes" / "favorites.vue",
    REPO_ROOT / "services" / "themeService.js",
    REPO_ROOT / "services" / "vibesRepo.js",
]

GARBLE_CHARS = set(
    "鏃鍦烘櫙鍙瑰墠褰撳厛涓弸鐨勫彧鏈夊悗鎴戝皢鑳藉埌鎵撳啓"
    "璇瘝娴犻槦鍣嗛傛帓缁闃鐜鍐鍢嗗畬澶嶄範璋辩场鎸屽姩"
    "鐩存敹钘忓叆鎹噷鐭彞璇勮鍣鈫鈥"
)
COMMON_CN_CHARS = set(
    "的一是在不了有人和你我他她它们这那就也很都把让给会要来去说看"
    "学习词根单词翻译句子场景收藏今日日常职场校园食堂游戏社交平台"
    "朋友返回继续进入打开配置同步复习完成任务进度查看删除恢复加入"
    "我的页面图谱练习根系来源说明标题内容音频输入选择播放"
)
COMMON_PUNCT = set("，。？！；：、（）《》【】“”‘’—…·：,.!?;:()[]<> ")
ASCII_CHARS = set(chr(i) for i in range(32, 127))

STRING_LITERAL_RE = re.compile(r'("([^"\\]|\\.)*"|\'([^\'\\]|\\.)*\')')
TEXT_NODE_RE = re.compile(r">([^<]+)<")
COMMENT_RE = re.compile(r"/\*([\s\S]*?)\*/")


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path: Path, data) -> None:
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def load_root_files():
    root_data_map = {}
    root_word_map = {}
    for path in sorted(ROOTS_DIR.glob("*.json")):
        data = read_json(path)
        root_id = str(data.get("rootId") or "").strip()
        if not root_id:
            continue
        root_data_map[root_id] = data
        for word in data.get("words", []):
            word_id = str(word.get("id") or "").strip()
            word_key = str(word.get("word") or "").strip().lower()
            if word_id:
                root_word_map[(root_id, word_id)] = word
            if word_key:
                root_word_map.setdefault((root_id, f"word::{word_key}"), word)
    return root_data_map, root_word_map


def derive_description_from_root(root_text: str) -> str:
    source = str(root_text or "").strip()
    if not source:
        return ""
    if any("\u4e00" <= ch <= "\u9fff" for ch in source):
        stripped = re.sub(r"^[A-Za-z0-9='\-/\s]+", "", source).strip()
        return stripped or source
    return ""


def sync_raw_roots(root_data_map):
    raw = read_json(RAW_ROOTS_PATH)
    roots = raw.get("roots", [])
    for item in roots:
        root_id = str(item.get("rootId") or "").strip()
        source = root_data_map.get(root_id)
        if not source:
            if not str(item.get("descriptionCn") or "").strip():
                item["descriptionCn"] = derive_description_from_root(item.get("root", ""))
            continue

        item["root"] = source.get("root", item.get("root", ""))
        item["meaning"] = source.get("meaning", item.get("meaning", ""))
        item["descriptionCn"] = source.get("descriptionCn", item.get("descriptionCn", ""))
        item["notes"] = source.get("notes", item.get("notes", ""))
        item["parentRootId"] = source.get("parentRootId", item.get("parentRootId", ""))
        item["rootLevel"] = source.get("rootLevel", item.get("rootLevel", 1))
        item["rootPath"] = source.get("rootPath", item.get("rootPath", root_id))
        item["type"] = source.get("type", item.get("type", "root"))
        item["updatedAt"] = source.get("updatedAt", item.get("updatedAt", ""))
        if "tags" in source:
            item["tags"] = source.get("tags") or item.get("tags", [])
        item["wordCount"] = len(source.get("words", []))

        if not str(item.get("descriptionCn") or "").strip():
            item["descriptionCn"] = derive_description_from_root(item.get("root", ""))

        if not str(item.get("descriptionCn") or "").strip():
            meaning_fallback = str(item.get("meaning") or "").strip()
            if meaning_fallback:
                item["descriptionCn"] = meaning_fallback

        if not str(item.get("descriptionCn") or "").strip():
            root_text = str(item.get("root") or "").strip()
            if len(root_text) == 1 and root_text.isalpha():
                item["descriptionCn"] = f"{root_text.upper()} 词根词缀总图"
            else:
                item["descriptionCn"] = root_text or root_id
    write_json(RAW_ROOTS_PATH, raw)


def sync_raw_words(root_word_map):
    words = read_json(RAW_WORDS_PATH)
    for item in words:
        root_id = str(item.get("rootId") or "").strip()
        word_id = str(item.get("id") or "").strip()
        word_key = str(item.get("word") or "").strip().lower()
        source = root_word_map.get((root_id, word_id)) or root_word_map.get((root_id, f"word::{word_key}"))
        if not source:
            continue
        item["word"] = source.get("word", item.get("word", ""))
        item["display"] = source.get("display", item.get("display", ""))
        item["phonetic"] = source.get("phonetic", item.get("phonetic", ""))
        item["translation"] = source.get("translation", item.get("translation", ""))
        item["sentence"] = source.get("sentence", item.get("sentence", ""))
        item["tags"] = source.get("tags", item.get("tags", []))
        item["level"] = source.get("level", item.get("level", 1))
    write_json(RAW_WORDS_PATH, words)


def score_text(text: str) -> int:
    common = sum(ch in COMMON_CN_CHARS for ch in text)
    cjk = sum("\u4e00" <= ch <= "\u9fff" for ch in text)
    garble = sum(ch in GARBLE_CHARS for ch in text)
    punct = sum(ch in COMMON_PUNCT for ch in text)
    ascii_count = sum(ch in ASCII_CHARS for ch in text)
    qmarks = text.count("?")
    replacement = text.count("�")
    return common * 4 + cjk * 2 + punct + ascii_count - garble * 5 - qmarks * 3 - replacement * 6


def repair_string(text: str) -> str:
    source = str(text or "")
    if not source:
        return source
    if not any(ch in GARBLE_CHARS for ch in source) and "鈫" not in source and "鈥" not in source:
        return source
    try:
        candidate = source.encode("gb18030", errors="ignore").decode("utf-8", errors="ignore")
    except Exception:
        return source
    if not candidate or candidate == source:
        return source
    if score_text(candidate) <= score_text(source):
        return source
    return candidate


def repair_json_value(value):
    if isinstance(value, dict):
        return {key: repair_json_value(inner) for key, inner in value.items()}
    if isinstance(value, list):
        return [repair_json_value(item) for item in value]
    if isinstance(value, str):
        return repair_string(value)
    return value


def repair_json_files():
    for path in VIBES_JSON_PATHS:
        write_json(path, repair_json_value(read_json(path)))


def repair_inline_content(text: str) -> str:
    def replace_string_literal(match):
        token = match.group(0)
        quote = token[0]
        body = token[1:-1]
        return quote + repair_string(body) + quote

    def replace_text_node(match):
        body = match.group(1)
        return ">" + repair_string(body) + "<"

    def replace_comment(match):
        body = match.group(1)
        return "/*" + repair_string(body) + "*/"

    updated = STRING_LITERAL_RE.sub(replace_string_literal, text)
    updated = TEXT_NODE_RE.sub(replace_text_node, updated)
    updated = COMMENT_RE.sub(replace_comment, updated)
    return updated


def repair_text_files():
    for path in TEXT_REPAIR_PATHS:
        source = path.read_text(encoding="utf-8")
        updated = repair_inline_content(source)
        if updated != source:
            path.write_text(updated, encoding="utf-8")


def main():
    root_data_map, root_word_map = load_root_files()
    sync_raw_roots(root_data_map)
    sync_raw_words(root_word_map)
    repair_json_files()
    repair_text_files()


if __name__ == "__main__":
    main()
